import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { PageSkeleton } from "@/components/page-skeleton";
import { LocalTime } from "@/components/local-time";
import { getContext } from "@/lib/workspace";
import type { WorkflowStep } from "@/lib/workflows";
import { WorkflowForm } from "../workflow-form";
import { deleteWorkflow, rotateWebhookToken, startWorkflow, updateWorkflow } from "../actions";
import { RunForm } from "../../agents/[id]/run-form";
import { DeleteButton } from "../../agents/[id]/delete-button";
import { WORKFLOW_RUN_SELECT, WorkflowRunsTable, type WorkflowRunRow } from "../../workflow-runs-table";

async function WorkflowContent({ params }: PageProps<"/workflows/[id]">) {
  const { id } = await params;
  const { supabase, workspace, canEdit } = await getContext();
  const [{ data: wf }, { data: agents }, { data: runs }] = await Promise.all([
    supabase.from("workflows").select("*").eq("id", id).maybeSingle(),
    supabase.from("agents").select("id, name").eq("workspace_id", workspace.id).order("name"),
    supabase
      .from("workflow_runs")
      .select(WORKFLOW_RUN_SELECT)
      .eq("workflow_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  if (!wf) notFound();

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const hookUrl = `${origin}/api/hooks/${wf.id}?token=${wf.webhook_token}`;

  return (
    <>
      <PageHeader
        title={wf.name}
        description={wf.description || undefined}
        actions={canEdit && <DeleteButton action={deleteWorkflow.bind(null, id)} />}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Run now</h2>
          <RunForm action={startWorkflow.bind(null, id)} />
        </Card>
        <Card className="text-sm">
          <h2 className="mb-3 font-semibold">Trigger</h2>
          {wf.trigger_type === "manual" && (
            <p className="text-zinc-500">Manual — use the Run button, or the API with an API key (Settings).</p>
          )}
          {wf.trigger_type === "schedule" && (
            <p className="text-zinc-500">
              Runs every <b>{wf.schedule_interval?.replace("ly", "")}</b>
              {wf.next_run_at && (
                <> · next run <LocalTime iso={wf.next_run_at} format="short" /></>
              )}
              . Requires Inngest (checks every 10 min) or the daily Vercel Cron fallback.
            </p>
          )}
          {wf.trigger_type === "webhook" && (
            <div className="space-y-2">
              <p className="text-zinc-500">POST any body to this URL. The body becomes {"{{input}}"}. Keep it secret.</p>
              <pre className="overflow-x-auto rounded bg-zinc-50 p-2 text-xs dark:bg-zinc-950">
                {`curl -X POST '${hookUrl}' \\\n  -H 'content-type: application/json' \\\n  -d '{"text":"hello"}'`}
              </pre>
              {canEdit && (
                <form action={rotateWebhookToken.bind(null, id)}>
                  <button className="text-xs font-medium text-indigo-600 hover:underline">Rotate token</button>
                </form>
              )}
            </div>
          )}
        </Card>
      </div>

      <h2 className="mt-8 mb-3 font-semibold">Recent runs</h2>
      {runs?.length ? (
        <WorkflowRunsTable runs={runs as unknown as WorkflowRunRow[]} />
      ) : (
        <EmptyState title="This workflow hasn't run yet" />
      )}

      <h2 className="mt-8 mb-3 font-semibold">Configuration</h2>
      <Card>
        <WorkflowForm
          workflow={{ ...wf, steps: wf.steps as WorkflowStep[] }}
          agents={agents ?? []}
          action={updateWorkflow.bind(null, id)}
          submitLabel="Save changes"
        />
      </Card>
    </>
  );
}

export default function WorkflowPage(props: PageProps<"/workflows/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <WorkflowContent {...props} />
    </Suspense>
  );
}
