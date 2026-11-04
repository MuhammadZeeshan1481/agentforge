import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CalendarClock, Hand, Play, Settings2, Webhook, Workflow } from "lucide-react";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState, PageHeader } from "@/components/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/misc";
import { PageSkeleton } from "@/components/page-skeleton";
import { LocalTime } from "@/components/local-time";
import { getContext } from "@/lib/workspace";
import { appOrigin } from "@/lib/origin";
import type { WorkflowStep } from "@/lib/workflows";
import { WorkflowForm } from "../workflow-form";
import { deleteWorkflow, rotateWebhookToken, startWorkflow, updateWorkflow } from "../actions";
import { WebhookBox } from "../webhook-box";
import { RunForm } from "../../agents/[id]/run-form";
import { DeleteButton } from "../../agents/[id]/delete-button";
import { WORKFLOW_RUN_SELECT, WorkflowRunsTable, type WorkflowRunRow } from "../../workflow-runs-table";

export const metadata: Metadata = { title: "Workflow" };

async function WorkflowContent({ params }: PageProps<"/workflows/[id]">) {
  const { id } = await params;
  const { supabase, workspace, canEdit } = await getContext();
  const [{ data: wf }, { data: agents }, { data: runs }] = await Promise.all([
    supabase.from("workflows").select("*").eq("id", id).maybeSingle(),
    supabase.from("agents").select("id, name").eq("workspace_id", workspace.id).order("name"),
    supabase.from("workflow_runs").select(WORKFLOW_RUN_SELECT).eq("workflow_id", id).order("created_at", { ascending: false }).limit(20),
  ]);
  if (!wf) notFound();
  const hookUrl = `${await appOrigin()}/api/hooks/${wf.id}?token=${wf.webhook_token}`;
  const steps = wf.steps as WorkflowStep[];

  return (
    <>
      <PageHeader
        icon={<Workflow className="size-5" />}
        title={wf.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {wf.description || `${steps.length} steps`}
            {wf.enabled ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Disabled</Badge>}
          </span>
        }
        back={{ href: "/workflows", label: "Workflows" }}
        actions={canEdit && <DeleteButton what="workflow" action={deleteWorkflow.bind(null, id)} />}
      />

      <Tabs defaultValue="run">
        <TabsList>
          <TabsTrigger value="run"><Play className="size-3.5" /> Run & history</TabsTrigger>
          <TabsTrigger value="builder"><Settings2 className="size-3.5" /> Builder</TabsTrigger>
        </TabsList>

        <TabsContent value="run" className="space-y-8">
          <div className="grid gap-4 lg:grid-cols-2">
            {canEdit && (
              <Card>
                <CardHeader><CardTitle>Run now</CardTitle><CardDescription>The text becomes <code>{"{{input}}"}</code>.</CardDescription></CardHeader>
                <CardContent><RunForm action={startWorkflow.bind(null, id)} placeholder="Input for this run…" label="Run workflow" /></CardContent>
              </Card>
            )}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {wf.trigger_type === "webhook" ? <Webhook className="size-4" /> : wf.trigger_type === "schedule" ? <CalendarClock className="size-4" /> : <Hand className="size-4" />}
                  Trigger
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                {wf.trigger_type === "manual" && <p className="text-muted-foreground">Manual — use Run now, or call the API with a key from Settings → API keys.</p>}
                {wf.trigger_type === "schedule" && (
                  <p className="text-muted-foreground">
                    Runs every <b className="text-foreground">{wf.schedule_interval?.replace("ly", "")}</b>
                    {wf.next_run_at && <> · next run <b className="text-foreground"><LocalTime iso={wf.next_run_at} format="short" /></b></>}.
                    {" "}Needs Inngest (checks every 10 min) or the daily Vercel Cron fallback.
                  </p>
                )}
                {wf.trigger_type === "webhook" && <WebhookBox url={hookUrl} onRotate={canEdit ? rotateWebhookToken.bind(null, id) : undefined} />}
              </CardContent>
            </Card>
          </div>
          <div>
            <h2 className="mb-3 text-sm font-semibold">Recent runs</h2>
            {runs?.length ? <WorkflowRunsTable runs={runs as unknown as WorkflowRunRow[]} /> : <EmptyState icon={<Play />} title="No runs yet" description="Runs from every trigger show up here." />}
          </div>
        </TabsContent>

        <TabsContent value="builder">
          <WorkflowForm workflow={{ ...wf, steps }} agents={agents ?? []} action={updateWorkflow.bind(null, id)} submitLabel="Save changes" />
        </TabsContent>
      </Tabs>
    </>
  );
}

export default function WorkflowPage(props: PageProps<"/workflows/[id]">) {
  return <Suspense fallback={<PageSkeleton />}><WorkflowContent {...props} /></Suspense>;
}
