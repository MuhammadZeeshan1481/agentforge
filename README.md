# AgentForge

AI Agent Builder + Workflow Automation Platform.

Create AI agents with instructions and tools, run them in the background, and watch every
model step and tool call stream in live.

## Features

| Area | What you get |
|---|---|
| **Agents** | Instructions, Gemini model, 13 tools, step limit. 5 templates. Version history with restore. Falls back to Flash-Lite automatically when the chosen model is overloaded. |
| **Tools** | Web fetch, HTTP request, knowledge-base search, long-term memory, send email (Resend), Slack, Gmail send/search, Sheets read/append, Notion search/create page, current time. Network tools have SSRF protection. |
| **Workflows** | Drag & drop builder (dnd-kit + Zustand) with agent, human-approval and condition steps. Pass data with `{{input}}`, `{{previous}}` and `{{stepN}}`. |
| **Triggers** | Manual, webhook (secret URL), schedule (hourly, daily or weekly), REST API |
| **Human-in-the-loop** | Workflows pause at approval steps. Editors get an email and approve or reject from the run page or the Approvals inbox. |
| **Knowledge base (RAG)** | PDF and text uploads. Chunks are embedded with Gemini, then searched with hybrid semantic + keyword retrieval (pgvector + Postgres FTS, reciprocal-rank fusion). Includes a test-retrieval box. |
| **Memory** | Agents save facts with `save_memory`. Saved facts are added to later runs, and you can view and delete them per agent. |
| **Integrations** | Google and Notion via OAuth. Tokens are encrypted with AES-256-GCM, and members can never read token columns. |
| **Observability** | Live execution traces, token usage, latency, success rates, analytics, and a monthly token budget |
| **Auth** | Sign up with password strength check; sign in with password, magic link or Google; forgot/reset password; resend confirmation; onboarding; account page (change name, email or password, delete account) |
| **Teams** | Multiple workspaces, a switcher, roles (owner, admin, editor, viewer), email or link invites |
| **API** | Workspace API keys (stored as SHA-256 hashes) and REST endpoints for agent and workflow runs |
| **Security** | RLS on every table. Runs, usage, memories, docs and tokens are written only by the server. Rate limits on runs, uploads, the API and webhooks. |
| **UI** | Shadcn-style components on Radix, light/dark/system themes, toasts, a collapsible sidebar, a mobile drawer, skeletons and empty states |

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
3. [`supabase/migrations/0003_semantic_integrations_profiles.sql`](supabase/migrations/0003_semantic_integrations_profiles.sql)

Optional services (email, Google, Notion, Google sign-in, Gemini paid tier) are covered in
[`docs/SETUP-INTEGRATIONS.md`](docs/SETUP-INTEGRATIONS.md).

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

`npm run test:e2e:m3` tests profiles, semantic search (a paraphrased question that keyword
search misses), rate limiting, AES-GCM encryption, connection-token privacy, PDF extraction and
graceful tool failures.

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

- Scanned PDFs (images only) contain no text, so they would need OCR.
- Google shows an "unverified app" screen until the OAuth app passes Google's verification.
  Test users can still connect.
- Supabase's built-in email sends only a few messages per hour. Configure Resend SMTP
  (see the setup guide).
- Without Inngest, runs execute in `after()` on the request that started them. That is limited
  by the function's max duration, and schedules fire only once a day (Vercel Cron on the Hobby
  plan).
- Payments and billing aren't included yet.

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
