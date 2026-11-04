-- AgentForge — semantic search (pgvector), rate limiting, user profiles,
-- OAuth connections (Google / Notion), email invites.
-- Run this whole file once in Supabase Dashboard → SQL Editor (after 0001 and 0002).

-- ─────────────────────────────────────────────────────────────
-- Profiles
-- ─────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 100),
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.profiles (id, full_name)
select u.id, coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', '')
from auth.users u
on conflict (id) do nothing;

alter table public.profiles enable row level security;
create policy "users read own profile" on public.profiles
  for select using (id = auth.uid());
create policy "users update own profile" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated, anon;
grant update (full_name, onboarded, updated_at) on public.profiles to authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  ws_id uuid;
  display_name text := coalesce(
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    split_part(new.email, '@', 1)
  );
begin
  insert into public.profiles (id, full_name) values (new.id, coalesce(display_name, ''))
  on conflict (id) do nothing;

  insert into public.workspaces (name, owner_id)
  values (coalesce(display_name, 'My') || '''s workspace', new.id)
  returning id into ws_id;

  insert into public.workspace_members (workspace_id, user_id, role, email)
  values (ws_id, new.id, 'owner', new.email);
  return new;
end;
$$;

-- Keep member emails in sync if a user changes their email
create or replace function public.handle_user_email_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email is distinct from old.email then
    update public.workspace_members set email = new.email where user_id = new.id;
  end if;
  return new;
end;
$$;
drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- ─────────────────────────────────────────────────────────────
-- Semantic search: pgvector embeddings on knowledge chunks
-- ─────────────────────────────────────────────────────────────
create extension if not exists vector with schema extensions;

alter table public.knowledge_chunks
  add column if not exists embedding extensions.vector(768);
create index if not exists knowledge_chunks_embedding_idx
  on public.knowledge_chunks using hnsw (embedding extensions.vector_cosine_ops);

alter table public.knowledge_docs
  add column if not exists source text not null default 'text' check (source in ('text', 'file', 'pdf')),
  add column if not exists file_name text,
  add column if not exists status text not null default 'ready' check (status in ('processing', 'ready', 'failed')),
  add column if not exists error text;

-- Hybrid search: reciprocal-rank fusion of vector similarity and full-text rank.
create or replace function public.search_knowledge_hybrid(
  ws uuid,
  query text,
  query_embedding extensions.vector(768),
  match_count int default 5
)
returns table (doc_id uuid, title text, content text, score double precision)
language sql stable set search_path = public, extensions as $$
  with semantic as (
    select c.id, row_number() over (order by c.embedding <=> query_embedding) as r
    from public.knowledge_chunks c
    where c.workspace_id = ws and c.embedding is not null
    order by c.embedding <=> query_embedding
    limit 30
  ),
  keyword as (
    select c.id, row_number() over (order by ts_rank(c.tsv, websearch_to_tsquery('simple', query)) desc) as r
    from public.knowledge_chunks c
    where c.workspace_id = ws and c.tsv @@ websearch_to_tsquery('simple', query)
    order by ts_rank(c.tsv, websearch_to_tsquery('simple', query)) desc
    limit 30
  ),
  fused as (
    select coalesce(s.id, k.id) as id,
           coalesce(1.0 / (60 + s.r), 0) + coalesce(1.0 / (60 + k.r), 0) as score
    from semantic s full outer join keyword k on s.id = k.id
  )
  select c.doc_id, d.title, c.content, f.score
  from fused f
  join public.knowledge_chunks c on c.id = f.id
  join public.knowledge_docs d on d.id = c.doc_id
  order by f.score desc
  limit greatest(1, least(match_count, 20));
$$;
revoke execute on function public.search_knowledge_hybrid(uuid, text, extensions.vector, int)
  from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- Rate limiting (fixed window counters, server-only)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (key, window_start)
);
alter table public.rate_limits enable row level security; -- no policies: server only
revoke all on public.rate_limits from authenticated, anon;

-- Returns true if the request is allowed, false if the limit is exceeded.
create or replace function public.rate_limit_hit(bucket text, window_seconds int, max_hits int)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  ws timestamptz := to_timestamp(floor(extract(epoch from now()) / window_seconds) * window_seconds);
  hits int;
begin
  insert into public.rate_limits (key, window_start, count)
  values (bucket, ws, 1)
  on conflict (key, window_start) do update set count = public.rate_limits.count + 1
  returning count into hits;
  -- opportunistic cleanup of old windows
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;
  return hits <= max_hits;
end;
$$;
revoke execute on function public.rate_limit_hit(text, int, int) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- OAuth connections (tokens are AES-256-GCM encrypted by the server)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  provider text not null check (provider in ('google', 'notion')),
  account_label text not null default '',
  scopes text not null default '',
  access_token_enc text not null,
  refresh_token_enc text,
  expires_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider)
);
alter table public.connections enable row level security;
create policy "members read connections" on public.connections
  for select using (public.is_workspace_member(workspace_id));
create policy "admins delete connections" on public.connections
  for delete using (public.is_workspace_admin(workspace_id));
-- Members may see that a connection exists, never the (encrypted) tokens.
revoke all on public.connections from authenticated, anon;
grant select (id, workspace_id, provider, account_label, scopes, created_by, created_at, updated_at)
  on public.connections to authenticated;
grant delete on public.connections to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Email invites
-- ─────────────────────────────────────────────────────────────
alter table public.workspace_invites add column if not exists email text;
alter table public.workspace_invites add column if not exists email_sent_at timestamptz;
