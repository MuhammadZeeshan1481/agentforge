import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { executeRun } from "./run-agent";
import { renderTemplate, type StepOutput, type WorkflowStep } from "@/lib/workflows";

type Db = ReturnType<typeof createAdminClient>;

async function finish(
  db: Db,
  id: string,
  patch: { status: "succeeded" | "failed"; output?: string | null; error?: string | null; outputs: StepOutput[] },
) {
  await db
    .from("workflow_runs")
    .update({ ...patch, finished_at: new Date().toISOString() })
    .eq("id", id);
}

/** queued → running. Returns false if someone else already took it. */
export async function claimWorkflowRun(id: string) {
  const db = createAdminClient();
  const { data } = await db
    .from("workflow_runs")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "queued")
    .select("id")
    .maybeSingle();
  return !!data;
}

/**
 * Executes the workflow run's current step and advances the pointer.
 * Each call does one step so a background job can checkpoint between steps.
 */
export async function advanceWorkflowOneStep(id: string): Promise<{ done: boolean }> {
  const db = createAdminClient();
  const { data: wr } = await db.from("workflow_runs").select("*").eq("id", id).single();
  if (!wr || wr.status !== "running") return { done: true };

  const steps = wr.steps as WorkflowStep[];
  const outputs = (wr.outputs ?? []) as StepOutput[];
  const i = wr.current_step as number;

  if (i >= steps.length) {
    const lastAgent = [...outputs].reverse().find((o) => o.type === "agent");
    await finish(db, id, { status: "succeeded", output: lastAgent?.output ?? wr.input, outputs });
    return { done: true };
  }

  const step = steps[i];
  try {
    if (step.type === "agent") {
      const { data: agent } = await db
        .from("agents")
        .select("id, workspace_id")
        .eq("id", step.agent_id)
        .maybeSingle();
      if (!agent || agent.workspace_id !== wr.workspace_id) {
        outputs[i] = { type: "agent", status: "failed", note: "Agent not found" };
        await finish(db, id, { status: "failed", error: `Step ${i + 1}: agent not found`, outputs });
        return { done: true };
      }
      const input = renderTemplate(step.input, wr.input, outputs);
      const { data: run, error } = await db
        .from("runs")
        .insert({
          workspace_id: wr.workspace_id,
          agent_id: agent.id,
          input: input.slice(0, 20000),
          workflow_run_id: id,
          step_index: i,
          created_by: wr.created_by,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);

      const result = await executeRun(run.id);
      const { data: finished } = await db.from("runs").select("status, output, error").eq("id", run.id).single();
      if (!result.ok || finished?.status !== "succeeded") {
        outputs[i] = { type: "agent", status: "failed", run_id: run.id, note: finished?.error ?? result.error };
        await finish(db, id, {
          status: "failed",
          error: `Step ${i + 1} failed: ${finished?.error ?? result.error ?? "unknown error"}`,
          outputs,
        });
        return { done: true };
      }
      outputs[i] = { type: "agent", status: "succeeded", run_id: run.id, output: finished.output ?? "" };
    } else if (step.type === "approval") {
      // Pause. A human approves/rejects from the UI, which re-queues the run.
      await db
        .from("workflow_runs")
        .update({
          status: "waiting_approval",
          approval_message: renderTemplate(step.message || "Approve to continue.", wr.input, outputs),
          outputs,
        })
        .eq("id", id);
      return { done: true };
    } else if (step.type === "condition") {
      const lastAgent = [...outputs].reverse().find((o) => o.type === "agent");
      const text = (lastAgent?.output ?? wr.input).toLowerCase();
      const has = text.includes((step.value ?? "").toLowerCase());
      const pass = step.mode === "contains" ? has : !has;
      if (!pass) {
        outputs[i] = { type: "condition", status: "stopped", note: "Condition not met — workflow stopped" };
        await finish(db, id, { status: "succeeded", output: lastAgent?.output ?? wr.input, outputs });
        return { done: true };
      }
      outputs[i] = { type: "condition", status: "passed" };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await finish(db, id, { status: "failed", error: `Step ${i + 1}: ${message}`, outputs });
    return { done: true };
  }

  await db.from("workflow_runs").update({ current_step: i + 1, outputs }).eq("id", id);
  return { done: false };
}

/** Run a whole workflow in-process (used when Inngest isn't configured). */
export async function runWorkflowInline(id: string) {
  if (!(await claimWorkflowRun(id))) return;
  for (let n = 0; n < 50; n++) {
    const { done } = await advanceWorkflowOneStep(id);
    if (done) return;
  }
}

/** Create a workflow run from a workflow (manual, webhook, schedule or API). */
export async function createWorkflowRun(
  workflowId: string,
  opts: { input: string; trigger: "manual" | "webhook" | "schedule"; createdBy?: string | null },
) {
  const db = createAdminClient();
  const { data: wf } = await db.from("workflows").select("*").eq("id", workflowId).maybeSingle();
  if (!wf) throw new Error("Workflow not found");
  if (!wf.enabled) throw new Error("Workflow is disabled");
  const steps = wf.steps as WorkflowStep[];
  if (!steps.length) throw new Error("Workflow has no steps");

  const { data, error } = await db
    .from("workflow_runs")
    .insert({
      workspace_id: wf.workspace_id,
      workflow_id: wf.id,
      input: opts.input.slice(0, 20000),
      trigger: opts.trigger,
      steps,
      created_by: opts.createdBy ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

/** Approve or reject a run that is waiting at an approval step. */
export async function decideApproval(id: string, approve: boolean, userId: string) {
  const db = createAdminClient();
  const { data: wr } = await db.from("workflow_runs").select("*").eq("id", id).single();
  if (!wr || wr.status !== "waiting_approval") return { ok: false, error: "Run is not waiting for approval" };
  const outputs = (wr.outputs ?? []) as StepOutput[];
  const i = wr.current_step as number;

  if (!approve) {
    outputs[i] = { type: "approval", status: "rejected" };
    await db
      .from("workflow_runs")
      .update({
        status: "failed",
        error: "Rejected by reviewer",
        outputs,
        decided_by: userId,
        finished_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "waiting_approval");
    return { ok: true, resumed: false };
  }

  outputs[i] = { type: "approval", status: "approved" };
  const { data } = await db
    .from("workflow_runs")
    .update({ status: "queued", current_step: i + 1, outputs, decided_by: userId, approval_message: null })
    .eq("id", id)
    .eq("status", "waiting_approval")
    .select("id")
    .maybeSingle();
  return { ok: !!data, resumed: !!data };
}

/** Start every scheduled workflow that is due. Returns the number started. */
export async function tickSchedules(dispatch: (workflowRunId: string) => Promise<void>) {
  const { SCHEDULE_INTERVALS } = await import("@/lib/workflows");
  const db = createAdminClient();
  const now = new Date();
  const { data: due } = await db
    .from("workflows")
    .select("id, schedule_interval, schedule_input, next_run_at")
    .eq("trigger_type", "schedule")
    .eq("enabled", true)
    .lte("next_run_at", now.toISOString())
    .limit(50);

  let started = 0;
  for (const wf of due ?? []) {
    const interval = SCHEDULE_INTERVALS[wf.schedule_interval as keyof typeof SCHEDULE_INTERVALS];
    if (!interval) continue;
    // Advance next_run_at first (optimistic lock on the old value) so overlapping ticks don't double-run.
    let next = new Date(wf.next_run_at).getTime() + interval;
    while (next <= now.getTime()) next += interval;
    const { data: locked } = await db
      .from("workflows")
      .update({ next_run_at: new Date(next).toISOString() })
      .eq("id", wf.id)
      .eq("next_run_at", wf.next_run_at)
      .select("id")
      .maybeSingle();
    if (!locked) continue;
    try {
      const runId = await createWorkflowRun(wf.id, { input: wf.schedule_input ?? "", trigger: "schedule" });
      await dispatch(runId);
      started++;
    } catch {
      // skip broken workflows; they stay scheduled
    }
  }
  return started;
}
