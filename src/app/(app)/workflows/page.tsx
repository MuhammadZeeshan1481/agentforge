import Link from "next/link";
import { Suspense } from "react";
import { Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { PageSkeleton } from "@/components/page-skeleton";
import { getContext } from "@/lib/workspace";
import type { WorkflowStep } from "@/lib/workflows";

const triggerLabel = { manual: "Manual", webhook: "Webhook", schedule: "Schedule" } as const;

async function WorkflowsContent() {
  const { supabase, workspace } = await getContext();
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
        actions={<LinkButton href="/workflows/new">New workflow</LinkButton>}
      />
      {!workflows?.length ? (
        <EmptyState title="No workflows yet">
          <LinkButton href="/workflows/new" className="mt-3">Create a workflow</LinkButton>
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {workflows.map((w) => {
            const steps = w.steps as WorkflowStep[];
            return (
              <Link key={w.id} href={`/workflows/${w.id}`}>
                <Card className="h-full transition hover:border-indigo-400">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{w.name}</p>
                    {!w.enabled && <span className="text-xs text-zinc-500">disabled</span>}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-zinc-500">{w.description || "No description"}</p>
                  <p className="mt-3 text-xs text-zinc-500">
                    {steps.length} steps · {triggerLabel[w.trigger_type as keyof typeof triggerLabel]}
                    {w.trigger_type === "schedule" && w.schedule_interval ? ` (${w.schedule_interval})` : ""}
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
  return (
    <Suspense fallback={<PageSkeleton />}>
      <WorkflowsContent />
    </Suspense>
  );
}
