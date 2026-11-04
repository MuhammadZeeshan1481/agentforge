import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui";
import { PageSkeleton } from "@/components/page-skeleton";
import { getContext } from "@/lib/workspace";
import { WorkflowForm } from "../workflow-form";
import { createWorkflow } from "../actions";

export const metadata: Metadata = { title: "New workflow" };

async function NewWorkflowContent() {
  const { supabase, workspace } = await getContext();
  const { data: agents } = await supabase.from("agents").select("id, name").eq("workspace_id", workspace.id).order("name");
  return (
    <>
      <PageHeader title="New workflow" description="Drag steps onto the canvas to build your flow." back={{ href: "/workflows", label: "Workflows" }} />
      <WorkflowForm agents={agents ?? []} action={createWorkflow} submitLabel="Create workflow" />
    </>
  );
}

export default function NewWorkflowPage() {
  return <Suspense fallback={<PageSkeleton />}><NewWorkflowContent /></Suspense>;
}
