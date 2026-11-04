import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Bot, CalendarClock, Filter, Hand, Plus, ShieldCheck, Webhook, Workflow } from "lucide-react";
import { Badge, Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { PageSkeleton } from "@/components/page-skeleton";
import { getContext } from "@/lib/workspace";
import type { WorkflowStep } from "@/lib/workflows";

export const metadata: Metadata = { title: "Workflows" };
const trig = { manual: { icon: Hand, label: "Manual" }, webhook: { icon: Webhook, label: "Webhook" }, schedule: { icon: CalendarClock, label: "Schedule" } } as const;
const stepIcon = { agent: Bot, approval: ShieldCheck, condition: Filter };

async function WorkflowsContent() {
  const { supabase, workspace, canEdit } = await getContext();
  const { data: workflows } = await supabase
    .from("workflows")
    .select("id, name, description, trigger_type, schedule_interval, enabled, steps")
    .eq("workspace_id", workspace.id)
    .order("updated_at", { ascending: false });

  return (
    <>
      <PageHeader
        title="Workflows"
        description="Chain agents, approvals and conditions — run manually, by webhook or on a schedule."
        actions={canEdit && <Button asChild><Link href="/workflows/new"><Plus /> New workflow</Link></Button>}
      />
      {!workflows?.length ? (
        <EmptyState icon={<Workflow />} title="No workflows yet" description="Drag agents, approvals and conditions into a flow." action={canEdit && <Button asChild><Link href="/workflows/new"><Plus /> Create a workflow</Link></Button>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {workflows.map((w) => {
            const steps = w.steps as WorkflowStep[];
            const T = trig[w.trigger_type as keyof typeof trig];
            return (
              <Link key={w.id} href={`/workflows/${w.id}`} className="group">
                <Card className="h-full p-5 transition group-hover:-translate-y-0.5 group-hover:border-primary/40 group-hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{w.name}</p>
                      <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{w.description || "No description"}</p>
                    </div>
                    {w.enabled ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Disabled</Badge>}
                  </div>
                  <div className="mt-5 flex items-center gap-1.5 overflow-hidden">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400"><T.icon className="size-4" /></span>
                    {steps.slice(0, 7).map((s, i) => {
                      const I = stepIcon[s.type];
                      return (
                        <span key={i} className="flex items-center gap-1.5">
                          <span className="h-px w-3 bg-border" />
                          <span className="flex size-8 items-center justify-center rounded-md border bg-background"><I className="size-4 text-muted-foreground" /></span>
                        </span>
                      );
                    })}
                    {steps.length > 7 && <span className="text-xs text-muted-foreground">+{steps.length - 7}</span>}
                  </div>
                  <p className="mt-4 text-xs text-muted-foreground">
                    {steps.length} steps · {T.label}{w.trigger_type === "schedule" && w.schedule_interval ? ` (${w.schedule_interval})` : ""}
                  </p>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

export default function WorkflowsPage() {
  return <Suspense fallback={<PageSkeleton />}><WorkflowsContent /></Suspense>;
}
