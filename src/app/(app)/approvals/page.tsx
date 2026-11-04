import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, CheckCircle2, ShieldCheck, Workflow } from "lucide-react";
import { Card, EmptyState, PageHeader, Section } from "@/components/ui";
import { PageSkeleton } from "@/components/page-skeleton";
import { LocalTime } from "@/components/local-time";
import { getContext } from "@/lib/workspace";
import { WORKFLOW_RUN_SELECT, WorkflowRunsTable, type WorkflowRunRow } from "../workflow-runs-table";

export const metadata: Metadata = { title: "Approvals" };

async function ApprovalsContent() {
  const { supabase, workspace } = await getContext();
  const [{ data: waiting }, { data: recent }] = await Promise.all([
    supabase.from("workflow_runs").select("id, approval_message, created_at, input, workflows(name)").eq("workspace_id", workspace.id).eq("status", "waiting_approval").order("created_at", { ascending: true }),
    supabase.from("workflow_runs").select(WORKFLOW_RUN_SELECT).eq("workspace_id", workspace.id).neq("status", "waiting_approval").order("created_at", { ascending: false }).limit(50),
  ]);
  return (
    <>
      <PageHeader title="Approvals" description="Workflow runs paused for a human decision, and recent workflow history." />
      {waiting?.length ? (
        <div className="grid gap-3">
          {waiting.map((w) => (
            <Link key={w.id} href={`/workflow-runs/${w.id}`} className="group">
              <Card className="flex items-center gap-4 border-warning/40 p-4 transition group-hover:shadow-md">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-warning/15 text-[color:var(--warning)]"><ShieldCheck className="size-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{(w.workflows as unknown as { name: string } | null)?.name ?? "Workflow"}</p>
                  <p className="line-clamp-1 text-sm text-muted-foreground">{w.approval_message}</p>
                </div>
                <span className="hidden text-xs text-muted-foreground sm:block"><LocalTime iso={w.created_at} format="short" /></span>
                <ArrowRight className="size-4 text-muted-foreground transition group-hover:translate-x-0.5" />
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState icon={<CheckCircle2 />} title="You’re all caught up" description="When a workflow reaches an approval step it appears here — and editors get an email if email is configured." />
      )}
      <Section title="Recent workflow runs">
        {recent?.length ? <WorkflowRunsTable runs={recent as unknown as WorkflowRunRow[]} /> : <EmptyState icon={<Workflow />} title="No workflow runs yet" />}
      </Section>
    </>
  );
}

export default function ApprovalsPage() {
  return <Suspense fallback={<PageSkeleton />}><ApprovalsContent /></Suspense>;
}
