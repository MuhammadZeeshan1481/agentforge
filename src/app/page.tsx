import Link from "next/link";
import { ArrowRight, Bot, BookOpen, Brain, CheckCircle2, Code2, Gauge, Mail, Plug, ShieldCheck, Webhook, Workflow, Wrench } from "lucide-react";
import { Button } from "@/components/ui";
import { Logo } from "@/components/app/logo";
import { ThemeToggle } from "@/components/app/theme-toggle";

const features = [
  { icon: Bot, title: "Agent builder", text: "Give an agent a role, instructions, a Gemini model and tools. Start from 5 templates." },
  { icon: Wrench, title: "Real tool calling", text: "Web fetch, any HTTP API, Gmail, Google Sheets, Notion, Slack and email — with SSRF protection." },
  { icon: Workflow, title: "Drag & drop workflows", text: "Chain agents, approvals and conditions. Pass data with {{previous}} and {{stepN}}." },
  { icon: ShieldCheck, title: "Human in the loop", text: "Workflows pause for approval and email your team. Approve or reject in one click." },
  { icon: Webhook, title: "Triggers & API", text: "Run on a schedule, from a webhook, or from your own code with API keys." },
  { icon: BookOpen, title: "Knowledge base (RAG)", text: "Upload PDFs and docs. Hybrid semantic + keyword search with pgvector." },
  { icon: Brain, title: "Long-term memory", text: "Agents remember facts across runs. Review and delete them any time." },
  { icon: Gauge, title: "Observability", text: "Live execution traces, token usage, latency, success rates and budgets." },
];

const steps = [
  { n: "1", title: "Describe the job", text: "Write instructions and pick the tools the agent may use." },
  { n: "2", title: "Wire it into a flow", text: "Drag agents, approvals and conditions into a workflow." },
  { n: "3", title: "Let it run", text: "Trigger it manually, by webhook, on a schedule or via API — and watch every step." },
];

export default function Home() {
  return (
    <div className="min-h-screen overflow-x-hidden">
      <header className="sticky top-0 z-40 border-b bg-background/75 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/"><Logo /></Link>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#how" className="hover:text-foreground">How it works</a>
            <a href="#developers" className="hover:text-foreground">Developers</a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle className="hidden sm:inline-flex" />
            <Button variant="ghost" asChild><Link href="/login">Sign in</Link></Button>
            <Button asChild><Link href="/signup">Get started</Link></Button>
          </div>
        </div>
      </header>

      <section className="relative">
        <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)] opacity-60" />
        <div className="pointer-events-none absolute top-[-200px] left-1/2 size-[700px] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4 pt-20 pb-16 text-center sm:px-6 sm:pt-28">
          <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-xs">
            <span className="size-1.5 rounded-full bg-success" /> AI agents + workflow automation
          </span>
          <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            Build AI agents that{" "}
            <span className="bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 bg-clip-text text-transparent">actually do the work</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-pretty text-muted-foreground">
            Give agents real tools, chain them into workflows with human approval, and watch every step live. Like Zapier and CrewAI — in one place.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Button size="lg" asChild><Link href="/signup">Start building free <ArrowRight /></Link></Button>
            <Button size="lg" variant="outline" asChild><Link href="/login">Sign in</Link></Button>
          </div>

          <div className="relative mx-auto mt-16 max-w-4xl">
            <div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-indigo-500/20 via-violet-500/20 to-fuchsia-500/20 blur-2xl" />
            <div className="relative overflow-hidden rounded-2xl border bg-card text-left shadow-2xl">
              <div className="flex items-center gap-1.5 border-b px-4 py-3">
                <span className="size-2.5 rounded-full bg-red-400" /><span className="size-2.5 rounded-full bg-amber-400" /><span className="size-2.5 rounded-full bg-emerald-400" />
                <span className="ml-3 text-xs text-muted-foreground">Workflow · Inbound lead → qualify → approve → reply</span>
              </div>
              <div className="grid gap-0 sm:grid-cols-[1fr_1.2fr]">
                <div className="space-y-2 border-b p-5 sm:border-r sm:border-b-0">
                  {[
                    { icon: Webhook, label: "Webhook trigger", tone: "text-sky-500" },
                    { icon: Bot, label: "Lead Qualifier", tone: "text-primary" },
                    { icon: ShieldCheck, label: "Human approval", tone: "text-amber-500" },
                    { icon: Mail, label: "Gmail · send reply", tone: "text-emerald-500" },
                  ].map((s, i) => (
                    <div key={s.label}>
                      <div className="flex items-center gap-3 rounded-lg border bg-background px-3 py-2.5 text-sm">
                        <s.icon className={`size-4 ${s.tone}`} /> {s.label}
                        <CheckCircle2 className="ml-auto size-4 text-success" />
                      </div>
                      {i < 3 && <div className="ml-5 h-3 w-px bg-border" />}
                    </div>
                  ))}
                </div>
                <div className="space-y-3 p-5 font-mono text-xs">
                  <p className="text-muted-foreground">▸ Called <span className="text-foreground">web_fetch</span> acme.example.com</p>
                  <p className="text-muted-foreground">▸ Model: <span className="text-foreground">HOT — 200 employees, clear need, this quarter</span></p>
                  <p className="text-muted-foreground">▸ Approved by <span className="text-foreground">Ayesha</span></p>
                  <p className="text-muted-foreground">▸ Called <span className="text-foreground">gmail_send</span> → sara@acme.example.com</p>
                  <p className="text-success">✓ Workflow succeeded · 3,412 tokens · 8.4 s</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
        <p className="text-sm font-medium text-primary">Everything you need</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">From one agent to a team of them</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-xl border bg-card p-5 shadow-xs transition hover:-translate-y-0.5 hover:shadow-md">
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="size-5" /></span>
              <p className="mt-4 font-medium">{title}</p>
              <p className="mt-1.5 text-sm text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="how" className="border-y bg-muted/30">
        <div className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight">How it works</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {steps.map((s) => (
              <div key={s.n} className="relative rounded-xl border bg-card p-6">
                <span className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-sm font-semibold text-white">{s.n}</span>
                <p className="mt-4 font-medium">{s.title}</p>
                <p className="mt-1.5 text-sm text-muted-foreground">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="developers" className="mx-auto grid max-w-6xl scroll-mt-20 items-center gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-primary"><Code2 className="size-4" /> For developers</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">Trigger agents from anywhere</h2>
          <p className="mt-4 text-muted-foreground">Every agent and workflow has a REST endpoint. Webhooks start workflows from Stripe, forms or GitHub. Keys are hashed, requests are rate-limited, and every table is protected by row-level security.</p>
          <ul className="mt-6 space-y-2 text-sm">
            {["Workspace API keys", "Webhook triggers with secret tokens", "Scheduled runs (hourly / daily / weekly)", "Google & Notion OAuth with encrypted tokens"].map((t) => (
              <li key={t} className="flex items-center gap-2"><CheckCircle2 className="size-4 text-success" /> {t}</li>
            ))}
          </ul>
        </div>
        <pre className="overflow-x-auto rounded-xl border bg-[#0c0b1d] p-5 text-xs leading-relaxed text-violet-100 shadow-xl">{`curl -X POST https://your-app/api/v1/agents/$AGENT/runs \\
  -H "Authorization: Bearer af_…" \\
  -d '{"input":"Summarize today’s unread email"}'

{ "run_id": "8c1f…", "status": "queued" }

curl https://your-app/api/v1/runs/8c1f… -H "Authorization: Bearer af_…"

{ "status": "succeeded", "output": "3 emails need a reply…",
  "input_tokens": 2190, "output_tokens": 312, "steps": [ … ] }`}</pre>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl bg-[#0c0b1d] px-6 py-14 text-center text-white sm:px-12">
          <div className="pointer-events-none absolute -top-24 left-1/2 size-[500px] -translate-x-1/2 rounded-full bg-violet-600/30 blur-3xl" />
          <h2 className="relative text-3xl font-semibold tracking-tight">Put your first agent to work today</h2>
          <p className="relative mx-auto mt-3 max-w-xl text-white/70">Free to start. Bring your own Gemini key. No credit card.</p>
          <Button size="lg" className="relative mt-8 bg-white text-[#0c0b1d] hover:bg-white/90" asChild>
            <Link href="/signup">Create your account <ArrowRight /></Link>
          </Button>
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:px-6">
          <Logo />
          <span className="flex items-center gap-2"><Plug className="size-4" /> Next.js · Supabase · Gemini · Inngest</span>
        </div>
      </footer>
    </div>
  );
}
