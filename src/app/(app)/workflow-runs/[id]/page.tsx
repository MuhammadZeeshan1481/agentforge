import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui";
import { PageSkeleton } from "@/components/page-skeleton";
import { LocalTime } from "@/components/local-time";
import { getContext } from "@/lib/workspace";
import { WorkflowRunLive } from "./workflow-run-live";

async function WorkflowRunContent({ params }: PageProps<"/workflow-runs/[id]">) {
  const { id } = await params;
  const { supabase, workspace, canEdit } = await getContext();
  const { data: wr } = await supabase
    .from("workflow_runs")
    .select("*, workflows(id, name)")
    .eq("id", id)
    .maybeSingle();
  if (!wr) notFound();
  const { data: agents } = await supabase.from("agents").select("id, name").eq("workspace_id", workspace.id);
  const agentNames = Object.fromEntries((agents ?? []).map((a) => [a.id, a.name]));
  const wf = wr.workflows as { id: string; name: string } | null;

  return (
    <>
      <PageHeader
        title={`Workflow run · ${wf?.name ?? "Workflow"}`}
        description={<LocalTime iso={wr.created_at} />}
        actions={
          wf && (
            <Link href={`/workflows/${wf.id}`} className="text-sm text-indigo-600 hover:underline">
              ← Back to workflow
            </Link>
          )
        }
      />
      <WorkflowRunLive initial={wr} agentNames={agentNames} canDecide={canEdit} />
    </>
  );
}

export default function WorkflowRunPage(props: PageProps<"/workflow-runs/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <WorkflowRunContent {...props} />
    </Suspense>
  );
}
