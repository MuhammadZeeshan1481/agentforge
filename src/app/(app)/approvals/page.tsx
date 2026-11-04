import { Suspense } from "react";
import { EmptyState, PageHeader } from "@/components/ui";
import { PageSkeleton } from "@/components/page-skeleton";
import { getContext } from "@/lib/workspace";
import { WORKFLOW_RUN_SELECT, WorkflowRunsTable, type WorkflowRunRow } from "../workflow-runs-table";

async function ApprovalsContent() {
  const { supabase, workspace } = await getContext();
  const [{ data: waiting }, { data: recent }] = await Promise.all([
    supabase
      .from("workflow_runs")
      .select(WORKFLOW_RUN_SELECT)
      .eq("workspace_id", workspace.id)
      .eq("status", "waiting_approval")
      .order("created_at", { ascending: true }),
    supabase
      .from("workflow_runs")
      .select(WORKFLOW_RUN_SELECT)
      .eq("workspace_id", workspace.id)
      .neq("status", "waiting_approval")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  return (
    <>
      <PageHeader title="Approvals & workflow runs" description="Workflow runs paused for a human decision, and recent history." />
      <h2 className="mb-3 font-semibold">Waiting for approval</h2>
      {waiting?.length ? (
        <WorkflowRunsTable runs={waiting as unknown as WorkflowRunRow[]} />
      ) : (
        <EmptyState title="Nothing waiting for you" />
      )}
      <h2 className="mt-8 mb-3 font-semibold">Recent workflow runs</h2>
      {recent?.length ? (
        <WorkflowRunsTable runs={recent as unknown as WorkflowRunRow[]} />
      ) : (
        <EmptyState title="No workflow runs yet" />
      )}
    </>
  );
}

export default function ApprovalsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ApprovalsContent />
    </Suspense>
  );
}
