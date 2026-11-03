# AgentForge

AI Agent Builder + Workflow Automation Platform.

Create AI agents with instructions and tools, run them in the background, and watch every
model step and tool call stream in live.

## Status: Milestone 1

| Feature | Status |
|---|---|
| Email/password auth (Supabase) | ✅ |
| Personal workspace per user (multi-tenant schema, RLS on every table) | ✅ |
| Agent CRUD (name, instructions, model, tools, max steps) | ✅ |
| Tools: web fetch, HTTP request (custom API), Slack post, current time | ✅ |
| SSRF protection for web/HTTP tools | ✅ |
| Run engine (Gemini via Vercel AI SDK, multi-step tool calling) | ✅ |
| Background runs via Inngest (fallback: `after()` without Inngest) | ✅ |
| Live step-by-step logs (Supabase Realtime + polling fallback) | ✅ |
| Dashboard: runs, success rate, token usage, monthly token budget | ✅ |
| Workflows, multi-agent, human approval, schedules | Milestone 2 |
| Memory / RAG, templates, analytics, teams UI | Milestone 3 |

## Stack

Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind CSS 4 · Supabase (Postgres,
Auth, Realtime) · Vercel AI SDK 5 + Google Gemini · Inngest · Vercel

## Setup

### 1. Database

Open Supabase Dashboard → **SQL Editor** → paste the whole of
[`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) → **Run**.

Run it **before** anyone signs up: it adds the trigger that gives every new user a workspace.

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
  Encrypted secrets (Supabase Vault) are planned for a later milestone.

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
