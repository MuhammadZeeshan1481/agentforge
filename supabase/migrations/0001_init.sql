-- AgentForge — Milestone 1 schema
-- Run this whole file once in Supabase Dashboard → SQL Editor.

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────
-- Workspaces (multi-tenant from day one)
-- ─────────────────────────────────────────────────────────────
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  owner_id uuid not null references auth.users (id) on delete cascade,
  monthly_token_limit integer not null default 500000 check (monthly_token_limit >= 0),
  created_at timestamptz not null default now()
);

create type public.workspace_role as enum ('owner', 'admin', 'editor', 'viewer');

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.workspace_role not null default 'editor',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index on public.workspace_members (user_id);

-- Helper functions (security definer so RLS policies don't recurse)
create or replace function public.is_workspace_member(ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws and user_id = auth.uid()
  );
$$;

create or replace function public.can_edit_workspace(ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws and user_id = auth.uid()
      and role in ('owner', 'admin', 'editor')
  );
$$;

-- Every new user gets a personal workspace
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare ws_id uuid;
begin
  insert into public.workspaces (name, owner_id)
  values (coalesce(split_part(new.email, '@', 1), 'My') || '''s workspace', new.id)
  returning id into ws_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (ws_id, new.id, 'owner');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- Agents
-- ─────────────────────────────────────────────────────────────
create table public.agents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  description text not null default '',
  instructions text not null default '' check (char_length(instructions) <= 20000),
  model text not null default 'gemini-3.5-flash-lite',
  tools text[] not null default '{}',
  -- per-tool settings, e.g. {"slack_post": {"webhook_url": "..."}}
  tool_config jsonb not null default '{}'::jsonb,
  max_steps integer not null default 8 check (max_steps between 1 and 25),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.agents (workspace_id);

-- ─────────────────────────────────────────────────────────────
-- Runs + step logs
-- ─────────────────────────────────────────────────────────────
create type public.run_status as enum ('queued', 'running', 'succeeded', 'failed');

create table public.runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  agent_id uuid not null references public.agents (id) on delete cascade,
  status public.run_status not null default 'queued',
  input text not null default '' check (char_length(input) <= 20000),
  output text,
  error text,
  model text,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
create index on public.runs (workspace_id, created_at desc);
create index on public.runs (agent_id, created_at desc);

create table public.run_steps (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.runs (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  kind text not null check (kind in ('info', 'llm', 'tool_call', 'tool_result', 'error')),
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on public.run_steps (run_id, id);

-- ─────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.agents enable row level security;
alter table public.runs enable row level security;
alter table public.run_steps enable row level security;

create policy "members read workspace" on public.workspaces
  for select using (public.is_workspace_member(id));
create policy "owner updates workspace" on public.workspaces
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "members read memberships" on public.workspace_members
  for select using (public.is_workspace_member(workspace_id));

create policy "members read agents" on public.agents
  for select using (public.is_workspace_member(workspace_id));
create policy "editors insert agents" on public.agents
  for insert with check (public.can_edit_workspace(workspace_id));
create policy "editors update agents" on public.agents
  for update using (public.can_edit_workspace(workspace_id))
  with check (public.can_edit_workspace(workspace_id));
create policy "editors delete agents" on public.agents
  for delete using (public.can_edit_workspace(workspace_id));

create policy "members read runs" on public.runs
  for select using (public.is_workspace_member(workspace_id));
-- Runs are created and updated only by the server (service role), which bypasses RLS.

create policy "members read run steps" on public.run_steps
  for select using (public.is_workspace_member(workspace_id));

-- Through the API, users may only rename a workspace (not change owner or token limit).
revoke update on public.workspaces from authenticated, anon;
grant update (name) on public.workspaces to authenticated;
-- Usage counters on runs are server-only too.
revoke insert, update, delete on public.runs, public.run_steps from authenticated, anon;

-- ─────────────────────────────────────────────────────────────
-- Realtime (live run logs)
-- ─────────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.runs;
alter publication supabase_realtime add table public.run_steps;
