import { Suspense } from "react";
import { Card, PageHeader } from "@/components/ui";
import { PageSkeleton } from "@/components/page-skeleton";
import { getContext } from "@/lib/workspace";
import { WorkflowForm } from "../workflow-form";
import { createWorkflow } from "../actions";

async function NewWorkflowContent() {
  const { supabase, workspace } = await getContext();
  const { data: agents } = await supabase
    .from("agents")
    .select("id, name")
    .eq("workspace_id", workspace.id)
    .order("name");
  return (
    <>
      <PageHeader title="New workflow" />
      <Card>
        <WorkflowForm agents={agents ?? []} action={createWorkflow} submitLabel="Create workflow" />
      </Card>
    </>
  );
}

export default function NewWorkflowPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NewWorkflowContent />
    </Suspense>
  );
}
