import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, BookOpen, Bot, CheckCircle2, Circle, Coins, Gauge, Play, Plug, ShieldCheck, Sparkles, UserPlus, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, Card, CardContent, CardHeader, CardTitle, EmptyState, PageHeader, Section, StatCard } from "@/components/ui";
import { PageSkeleton } from "@/components/page-skeleton";
import { UrlToast } from "@/components/app/url-toast";
import { getContext } from "@/lib/workspace";
import { RUN_ROW_SELECT, RunsTable, type RunRow } from "../runs-table";
import { WORKFLOW_RUN_SELECT, WorkflowRunsTable, type WorkflowRunRow } from "../workflow-runs-table";

export const metadata: Metadata = { title: "Dashboard" };

async function DashboardContent() {
  const { supabase, workspace, profile, canEdit } = await getContext();
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const count = (table: string) => supabase.from(table).select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id);
  const [agents, workflows, docs, conns, members, { data: monthRuns }, { data: recent }, { data: waiting }] = await Promise.all([
    count("agents"),
    count("workflows"),
    count("knowledge_docs"),
    count("connections"),
    supabase.from("workspace_members").select("user_id", { count: "exact", head: true }).eq("workspace_id", workspace.id),
    supabase.from("runs").select("status, input_tokens, output_tokens").eq("workspace_id", workspace.id).gte("created_at", monthStart.toISOString()),
    supabase.from("runs").select(RUN_ROW_SELECT).eq("workspace_id", workspace.id).order("created_at", { ascending: false }).limit(6),
    supabase.from("workflow_runs").select(WORKFLOW_RUN_SELECT).eq("workspace_id", workspace.id).eq("status", "waiting_approval").order("created_at").limit(5),
  ]);

  const runs = monthRuns ?? [];
  const finished = runs.filter((r) => r.status === "succeeded" || r.status === "failed");
  const ok = runs.filter((r) => r.status === "succeeded").length;
  const tokens = runs.reduce((n, r) => n + r.input_tokens + r.output_tokens, 0);
  const pct = Math.min(100, Math.round((tokens / Math.max(1, workspace.monthly_token_limit)) * 100));

  const checklist = [
    { done: (agents.count ?? 0) > 0, label: "Create your first agent", href: "/agents/new", icon: Bot },
    { done: runs.length > 0 || (recent?.length ?? 0) > 0, label: "Run an agent and watch the trace", href: "/agents", icon: Play },
    { done: (workflows.count ?? 0) > 0, label: "Build a workflow with an approval step", href: "/workflows/new", icon: Workflow },
    { done: (docs.count ?? 0) > 0, label: "Add a document to the knowledge base", href: "/knowledge", icon: BookOpen },
    { done: (conns.count ?? 0) > 0, label: "Connect Google or Notion", href: "/integrations", icon: Plug },
    { done: (members.count ?? 0) > 1, label: "Invite a teammate", href: "/settings#members", icon: UserPlus },
  ];
  const doneCount = checklist.filter((c) => c.done).length;

  return (
    <>
      <Suspense><UrlToast /></Suspense>
      <PageHeader
        title={`Welcome back, ${profile.fullName.split(" ")[0]}`}
        description={`Here’s what’s happening in ${workspace.name} this month.`}
        actions={canEdit && (
          <>
            <Button variant="outline" asChild><Link href="/workflows/new"><Workflow /> New workflow</Link></Button>
            <Button asChild><Link href="/agents/new"><Bot /> New agent</Link></Button>
          </>
        )}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Agents" value={agents.count ?? 0} icon={<Bot />} hint={`${workflows.count ?? 0} workflows`} />
        <StatCard label="Runs this month" value={runs.length} icon={<Play />} hint={`${finished.length - ok} failed`} />
        <StatCard label="Success rate" value={finished.length ? `${Math.round((ok / finished.length) * 100)}%` : "—"} icon={<Gauge />} />
        <StatCard label="Tokens this month" value={tokens.toLocaleString()} icon={<Coins />} hint={`${pct}% of budget`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          {(waiting?.length ?? 0) > 0 && (
            <Card className="border-warning/40 bg-warning/[0.04]">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2"><ShieldCheck className="size-4 text-[color:var(--warning)]" /> Waiting for your approval</CardTitle>
                <Link href="/approvals" className="text-sm font-medium text-primary hover:underline">View all</Link>
              </CardHeader>
              <CardContent><WorkflowRunsTable runs={waiting as unknown as WorkflowRunRow[]} /></CardContent>
            </Card>
          )}
          <Card>
            <CardHeader><CardTitle>Monthly token budget</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-end justify-between text-sm">
                <span className="text-2xl font-semibold tabular-nums">{tokens.toLocaleString()}</span>
                <span className="text-muted-foreground tabular-nums">of {workspace.monthly_token_limit.toLocaleString()}</span>
              </div>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted">
                <div className={cn("h-full rounded-full transition-all", pct >= 90 ? "bg-destructive" : pct >= 70 ? "bg-warning" : "bg-gradient-to-r from-indigo-500 to-fuchsia-500")} style={{ width: `${Math.max(pct, 1)}%` }} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Runs are blocked when the budget is used up. It resets on the 1st of each month (UTC).</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Sparkles className="size-4 text-primary" /> Getting started</CardTitle>
            <p className="text-sm text-muted-foreground">{doneCount} of {checklist.length} done</p>
          </CardHeader>
          <CardContent className="pt-3">
            <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${(doneCount / checklist.length) * 100}%` }} /></div>
            <ul className="space-y-1">
              {checklist.map((c) => (
                <li key={c.label}>
                  <Link href={c.href} className="group flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted">
                    {c.done ? <CheckCircle2 className="size-4 text-success" /> : <Circle className="size-4 text-muted-foreground" />}
                    <span className={cn("flex-1", c.done && "text-muted-foreground line-through")}>{c.label}</span>
                    {!c.done && <ArrowRight className="size-4 text-muted-foreground opacity-0 transition group-hover:opacity-100" />}
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Section title="Recent runs" actions={<Link href="/runs" className="text-sm font-medium text-primary hover:underline">View all</Link>}>
        {recent?.length ? (
          <RunsTable runs={recent as unknown as RunRow[]} />
        ) : (
          <EmptyState icon={<Play />} title="No runs yet" description="Create an agent and give it a task — every step shows up live." action={canEdit && <Button asChild><Link href="/agents/new">Create an agent</Link></Button>} />
        )}
      </Section>
    </>
  );
}

export default function DashboardPage() {
  return <Suspense fallback={<PageSkeleton />}><DashboardContent /></Suspense>;
}
