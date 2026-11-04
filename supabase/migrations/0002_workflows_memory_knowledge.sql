-- AgentForge — Milestones 2 & 3
-- Workflows + approvals + triggers, memory, knowledge base, API keys,
-- agent versions, team invites.
-- Run this whole file once in Supabase Dashboard → SQL Editor (after 0001).

-- ─────────────────────────────────────────────────────────────
-- Members: keep email for the team UI (auth.users isn't exposed via the API)
-- ─────────────────────────────────────────────────────────────
alter table public.workspace_members add column if not exists email text;

update public.workspace_members m
set email = u.email
from auth.users u
where u.id = m.user_id and m.email is null;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare ws_id uuid;
begin
  insert into public.workspaces (name, owner_id)
  values (coalesce(split_part(new.email, '@', 1), 'My') || '''s workspace', new.id)
  returning id into ws_id;

  insert into public.workspace_members (workspace_id, user_id, role, email)
  values (ws_id, new.id, 'owner', new.email);
  return new;
end;
$$;

create or replace function public.is_workspace_admin(ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws and user_id = auth.uid() and role in ('owner', 'admin')
  );
$$;

-- Admins can remove members (but nobody can remove the owner row via the API)
create policy "admins remove members" on public.workspace_members
  for delete using (public.is_workspace_admin(workspace_id) and role <> 'owner');

-- ─────────────────────────────────────────────────────────────
-- Workflows
-- steps: [{ "type": "agent", "agent_id": uuid, "input": "template" }
--         | { "type": "approval", "message": "text" }
--         | { "type": "condition", "mode": "contains"|"not_contains", "value": "text" }]
-- ─────────────────────────────────────────────────────────────
create type public.trigger_type as enum ('manual', 'webhook', 'schedule');
create type public.schedule_interval as enum ('hourly', 'daily', 'weekly');

create table public.workflows (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  description text not null default '',
  steps jsonb not null default '[]'::jsonb check (jsonb_typeof(steps) = 'array'),
  trigger_type public.trigger_type not null default 'manual',
  schedule_interval public.schedule_interval,
  schedule_input text not null default '',
  next_run_at timestamptz,
  webhook_token text not null default encode(gen_random_bytes(24), 'hex'),
  enabled boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.workflows (workspace_id);
create index on public.workflows (next_run_at) where trigger_type = 'schedule' and enabled;

create type public.workflow_run_status as enum
  ('queued', 'running', 'waiting_approval', 'succeeded', 'failed');

create table public.workflow_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  workflow_id uuid not null references public.workflows (id) on delete cascade,
  status public.workflow_run_status not null default 'queued',
  trigger public.trigger_type not null default 'manual',
  input text not null default '' check (char_length(input) <= 20000),
  steps jsonb not null,               -- snapshot of the workflow's steps at start
  current_step integer not null default 0,
  outputs jsonb not null default '[]'::jsonb, -- per-step results
  output text,
  error text,
  approval_message text,
  decided_by uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
create index on public.workflow_runs (workspace_id, created_at desc);
create index on public.workflow_runs (workflow_id, created_at desc);
create index on public.workflow_runs (workspace_id) where status = 'waiting_approval';

-- Agent runs can belong to a workflow run
alter table public.runs
  add column if not exists workflow_run_id uuid references public.workflow_runs (id) on delete cascade,
  add column if not exists step_index integer;
create index if not exists runs_workflow_run_idx on public.runs (workflow_run_id);

alter table public.workflows enable row level security;
alter table public.workflow_runs enable row level security;

create policy "members read workflows" on public.workflows
  for select using (public.is_workspace_member(workspace_id));
create policy "editors insert workflows" on public.workflows
  for insert with check (public.can_edit_workspace(workspace_id));
create policy "editors update workflows" on public.workflows
  for update using (public.can_edit_workspace(workspace_id))
  with check (public.can_edit_workspace(workspace_id));
create policy "editors delete workflows" on public.workflows
  for delete using (public.can_edit_workspace(workspace_id));

create policy "members read workflow runs" on public.workflow_runs
  for select using (public.is_workspace_member(workspace_id));
revoke insert, update, delete on public.workflow_runs from authenticated, anon;

-- ─────────────────────────────────────────────────────────────
-- Agent memory
-- ─────────────────────────────────────────────────────────────
create table public.agent_memories (
  id bigint generated always as identity primary key,
  agent_id uuid not null references public.agents (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  source_run_id uuid references public.runs (id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.agent_memories (agent_id, created_at desc);

alter table public.agent_memories enable row level security;
create policy "members read memories" on public.agent_memories
  for select using (public.is_workspace_member(workspace_id));
create policy "editors delete memories" on public.agent_memories
  for delete using (public.can_edit_workspace(workspace_id));
revoke insert, update on public.agent_memories from authenticated, anon;

-- ─────────────────────────────────────────────────────────────
-- Knowledge base (Postgres full-text search, no embeddings needed)
-- ─────────────────────────────────────────────────────────────
create table public.knowledge_docs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  content text not null check (char_length(content) <= 500000),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.knowledge_docs (workspace_id, created_at desc);

create table public.knowledge_chunks (
  id bigint generated always as identity primary key,
  doc_id uuid not null references public.knowledge_docs (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  tsv tsvector generated always as (to_tsvector('simple', content)) stored
);
create index on public.knowledge_chunks using gin (tsv);
create index on public.knowledge_chunks (workspace_id);

alter table public.knowledge_docs enable row level security;
alter table public.knowledge_chunks enable row level security;
create policy "members read docs" on public.knowledge_docs
  for select using (public.is_workspace_member(workspace_id));
create policy "editors delete docs" on public.knowledge_docs
  for delete using (public.can_edit_workspace(workspace_id));
create policy "members read chunks" on public.knowledge_chunks
  for select using (public.is_workspace_member(workspace_id));
-- docs/chunks are inserted by the server (it does the chunking)
revoke insert, update on public.knowledge_docs, public.knowledge_chunks from authenticated, anon;

-- Ranked search, called by the server with the service role
create or replace function public.search_knowledge(ws uuid, query text, match_count int default 5)
returns table (doc_id uuid, title text, content text, rank real)
language sql stable set search_path = public as $$
  with q as (select websearch_to_tsquery('simple', query) as tsq)
  select c.doc_id, d.title, c.content, ts_rank(c.tsv, q.tsq) as rank
  from public.knowledge_chunks c
  join public.knowledge_docs d on d.id = c.doc_id
  cross join q
  where c.workspace_id = ws and c.tsv @@ q.tsq
  order by rank desc
  limit greatest(1, least(match_count, 20));
$$;
revoke execute on function public.search_knowledge(uuid, text, int) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- Agent versions
-- ─────────────────────────────────────────────────────────────
create table public.agent_versions (
  id bigint generated always as identity primary key,
  agent_id uuid not null references public.agents (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  version integer not null,
  snapshot jsonb not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (agent_id, version)
);
alter table public.agent_versions enable row level security;
create policy "members read versions" on public.agent_versions
  for select using (public.is_workspace_member(workspace_id));
create policy "editors insert versions" on public.agent_versions
  for insert with check (public.can_edit_workspace(workspace_id));

-- ─────────────────────────────────────────────────────────────
-- API keys (only a SHA-256 hash is stored)
-- ─────────────────────────────────────────────────────────────
create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  prefix text not null,
  key_hash text not null unique,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
alter table public.api_keys enable row level security;
create policy "admins read api keys" on public.api_keys
  for select using (public.is_workspace_admin(workspace_id));
revoke insert, update, delete on public.api_keys from authenticated, anon;

-- ─────────────────────────────────────────────────────────────
-- Team invites
-- ─────────────────────────────────────────────────────────────
create table public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  role public.workspace_role not null default 'editor' check (role <> 'owner'),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz
);
alter table public.workspace_invites enable row level security;
create policy "admins read invites" on public.workspace_invites
  for select using (public.is_workspace_admin(workspace_id));
revoke insert, update, delete on public.workspace_invites from authenticated, anon;

-- ─────────────────────────────────────────────────────────────
-- Realtime
-- ─────────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.workflow_runs;
