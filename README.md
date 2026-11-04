# AgentForge

AI Agent Builder + Workflow Automation Platform.

Create AI agents with instructions and tools, run them in the background, and watch every
model step and tool call stream in live.

## Features

| Area | What you get |
|---|---|
| **Agents** | Instructions, model (Gemini), tools, step limit. 5 ready-made templates. Version history with restore. |
| **Tools** | Web fetch, HTTP request (custom APIs), Slack post, current time, long-term memory, knowledge-base search. SSRF protection on network tools. |
| **Runs** | Background execution. Every model step and tool call is logged and streamed live. Token usage per run, with a monthly budget per workspace. |
| **Workflows** | Chain agent steps, human-approval steps and conditions. Pass data between steps with `{{input}}`, `{{previous}}`, `{{step1}}`… |
| **Triggers** | Manual, webhook (secret URL), schedule (hourly, daily or weekly), public API |
| **Human-in-the-loop** | A workflow pauses at an approval step. Reviewers approve or reject from the run page or the Approvals inbox. |
| **Memory** | Agents save facts with `save_memory`. Saved facts are added to every later run. You can view and delete them per agent. |
| **Knowledge base** | Paste or upload text docs. They are split into chunks and searched with Postgres full-text search. |
| **Analytics** | Runs per day, success rate, latency and tokens, overall and per agent |
| **Teams** | Multiple workspaces per user, invite links with roles (admin, editor, viewer), workspace switcher |
| **API** | Workspace API keys (stored only as SHA-256 hashes) and REST endpoints for agent and workflow runs |
| **Security** | RLS on every table. Runs, usage, memories and docs are written only by the server. Token budgets can't be changed through the API. |

## Stack

Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind CSS 4 · Supabase (Postgres,
Auth, Realtime) · Vercel AI SDK 5 + Google Gemini · Inngest · Vercel

## Setup

### 1. Database

In Supabase Dashboard → **SQL Editor**, run each migration in order. Paste the whole file and
click **Run**:

1. [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql). Run it **before**
   anyone signs up: it adds the trigger that gives every new user a workspace.
2. [`supabase/migrations/0002_workflows_memory_knowledge.sql`](supabase/migrations/0002_workflows_memory_knowledge.sql)

### 2. Auth settings

Supabase Dashboard → **Authentication → URL Configuration**:

- **Site URL:** your app URL (e.g. `https://agentforge.vercel.app`, or `http://localhost:3000`)
- **Redirect URLs:** add `<your app URL>/auth/callback`

For faster local testing you can turn off **Confirm email** under Authentication → Providers →
Email.

### 3. Environment variables

Copy `.env.example` to `.env.local` and fill it in:

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → API Keys (publishable / anon) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API Keys (secret / service_role). **Server only.** |
| `GOOGLE_GENERATIVE_AI_API_KEY` | https://aistudio.google.com/apikey |

### 4. Run locally

```bash
npm install
npm run dev
```

Optional, for real background jobs locally:

```bash
npx inngest-cli@latest dev
```

and set `INNGEST_DEV=1` in `.env.local`.

### 5. Deploy to Vercel

1. Import the GitHub repo in Vercel and add the four environment variables above.
2. Set the function region near the database: **Settings → Functions → Region → Tokyo
   (hnd1)** (the Supabase project is in `ap-northeast-1`).
3. Install the **Inngest** integration from the Vercel marketplace. It sets `INNGEST_EVENT_KEY`
   and `INNGEST_SIGNING_KEY` and syncs `/api/inngest`.
4. Update Supabase **Site URL / Redirect URLs** to the Vercel URL.
5. Optional: add `CRON_SECRET` (any random string). Vercel Cron then calls `/api/cron/tick`
   once a day as a fallback scheduler when Inngest isn't installed. With Inngest, schedules are
   checked every 10 minutes.

## Public API

Create a key in **Settings → API keys**, then:

```bash
# Start an agent run → 202 { "run_id": "…" }
curl -X POST https://<app>/api/v1/agents/<AGENT_ID>/runs \
  -H "Authorization: Bearer af_…" -H "content-type: application/json" \
  -d '{"input":"Summarize https://example.com"}'

# Get status, output, usage and steps
curl https://<app>/api/v1/runs/<RUN_ID> -H "Authorization: Bearer af_…"

# Workflows
curl -X POST https://<app>/api/v1/workflows/<WORKFLOW_ID>/runs -H "Authorization: Bearer af_…" -d '{"input":"…"}'
curl https://<app>/api/v1/workflow-runs/<WORKFLOW_RUN_ID> -H "Authorization: Bearer af_…"

# Webhook trigger: the body becomes {{input}}
curl -X POST "https://<app>/api/hooks/<WORKFLOW_ID>?token=<WEBHOOK_TOKEN>" -d '{"event":"…"}'
```

## Testing

`npm run test:e2e:m2 [baseUrl]` tests workflows, approvals, conditions, schedules, memory, the
knowledge base, and RLS on the new tables. With `baseUrl` (a running app) it also tests the
webhook and API routes over HTTP.

`npm run test:e2e` runs an end-to-end check against your real Supabase project (needs the four
env vars). It creates two temporary users, then checks:

- the signup trigger creates a workspace
- RLS isolation between workspaces
- that users can't write runs or raise their token limit
- that an agent run with a real tool call works through the engine

It deletes the test users afterwards.

## Architecture

```
Browser ──server action──▶ startRun ──insert run (service role)──▶ dispatchRun
                                                                     │
                       Inngest event "agent/run.requested" ◀─────────┘ (or after())
                                     │
                                     ▼
                       executeRun(runId)
                         ├─ claim run (queued → running, idempotent)
                         ├─ check monthly token budget
                         ├─ generateText(Gemini, tools, stopWhen: stepCountIs(max_steps))
                         │     └─ onStepFinish → insert run_steps, update token totals
                         └─ mark succeeded / failed
                                     │
Browser ◀── Supabase Realtime (runs, run_steps, RLS-filtered) ◀──────┘
```

### Security notes

- RLS on every table. Users can read only their workspace's data, and only editors can change
  agents.
- Runs and run steps are written only by the server (service role). Users have no insert or
  update grants on them, so they can't fake token usage.
- `monthly_token_limit` can't be changed through the public API.
- The web and HTTP tools block private, loopback, link-local and metadata IPs, and re-check
  every redirect. A DNS-rebinding race is still theoretically possible. For stronger isolation,
  put tool traffic behind an egress proxy.
- The Slack webhook URL is stored in `agents.tool_config` and is visible to workspace members.
- Webhook tokens are compared in constant time. API keys are shown once and stored only as
  hashes.

## Known limitations

- Knowledge-base search is keyword-based (Postgres full-text search), not semantic. Adding
  embeddings (pgvector) is the natural next step.
- Uploads accept text formats only (.txt, .md, .csv, .json). PDF parsing isn't included.
- Without Inngest, runs execute in `after()` on the request that started them. That is limited
  by the function's max duration, and schedules fire only once a day (Vercel Cron on the Hobby
  plan).
- Invites are shareable links. Emails are not sent.

## Project layout

```
src/
  app/
    (app)/            authenticated app: dashboard, agents, runs
    api/inngest/      Inngest endpoint
    auth/             email callback + sign out
    login/            sign in / sign up
  inngest/            Inngest client + functions
  lib/
    engine/           run engine + dispatcher
    supabase/         server / browser / admin clients, proxy session refresh
    tools/            tool catalog, registry, SSRF-safe fetch
  proxy.ts            session refresh + auth redirects
supabase/migrations/  SQL schema
```
