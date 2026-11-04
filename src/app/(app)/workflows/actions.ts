"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getContext } from "@/lib/workspace";
import { createWorkflowRun, decideApproval } from "@/lib/engine/workflow";
import { dispatchWorkflowRun } from "@/lib/engine/dispatch";
import { SCHEDULE_INTERVALS } from "@/lib/workflows";

export type FormState = { error?: string; ok?: boolean };

const Step = z.discriminatedUnion("type", [
  z.object({ type: z.literal("agent"), agent_id: z.string().uuid("Pick an agent for every agent step"), input: z.string().max(5000).default("{{previous}}") }),
  z.object({ type: z.literal("approval"), message: z.string().max(1000).default("") }),
  z.object({ type: z.literal("condition"), mode: z.enum(["contains", "not_contains"]), value: z.string().min(1, "Condition text is required").max(200) }),
]);

const WorkflowInput = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(100),
    description: z.string().trim().max(500).default(""),
    trigger_type: z.enum(["manual", "webhook", "schedule"]),
    schedule_interval: z.enum(["hourly", "daily", "weekly"]).nullable(),
    schedule_input: z.string().max(5000).default(""),
    enabled: z.boolean(),
    steps: z.array(Step).min(1, "Add at least one step").max(20),
  })
  .refine((w) => w.trigger_type !== "schedule" || w.schedule_interval, {
    message: "Pick a schedule interval",
  })
  .refine((w) => w.steps.some((s) => s.type === "agent"), { message: "Add at least one agent step" });

async function parseWorkflow(formData: FormData, workspaceId: string) {
  let steps: unknown;
  try {
    steps = JSON.parse(String(formData.get("steps") ?? "[]"));
  } catch {
    return { error: "Invalid steps" } as const;
  }
  const parsed = WorkflowInput.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    trigger_type: formData.get("trigger_type"),
    schedule_interval: formData.get("schedule_interval") || null,
    schedule_input: formData.get("schedule_input") ?? "",
    enabled: formData.get("enabled") === "on",
    steps,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message } as const;

  // Every agent step must belong to this workspace (RLS also hides others).
  const { supabase } = await getContext();
  const agentIds = parsed.data.steps.flatMap((s) => (s.type === "agent" ? [s.agent_id] : []));
  const { data: agents } = await supabase
    .from("agents")
    .select("id")
    .eq("workspace_id", workspaceId)
    .in("id", agentIds);
  if ((agents?.length ?? 0) !== new Set(agentIds).size) return { error: "Unknown agent in steps" } as const;

  const d = parsed.data;
  return {
    data: {
      ...d,
      schedule_interval: d.trigger_type === "schedule" ? d.schedule_interval : null,
      next_run_at:
        d.trigger_type === "schedule" && d.schedule_interval
          ? new Date(Date.now() + SCHEDULE_INTERVALS[d.schedule_interval]).toISOString()
          : null,
    },
  } as const;
}

export async function createWorkflow(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, user, workspace } = await getContext();
  const parsed = await parseWorkflow(formData, workspace.id);
  if ("error" in parsed) return { error: parsed.error };
  const { data, error } = await supabase
    .from("workflows")
    .insert({ ...parsed.data, workspace_id: workspace.id, created_by: user.id })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/workflows");
  redirect(`/workflows/${data.id}`);
}

export async function updateWorkflow(id: string, _: FormState, formData: FormData): Promise<FormState> {
  const { supabase, workspace } = await getContext();
  const parsed = await parseWorkflow(formData, workspace.id);
  if ("error" in parsed) return { error: parsed.error };
  // Keep the existing schedule slot if the interval didn't change.
  const { data: existing } = await supabase
    .from("workflows")
    .select("schedule_interval, next_run_at, trigger_type")
    .eq("id", id)
    .single();
  const patch: Record<string, unknown> = { ...parsed.data, updated_at: new Date().toISOString() };
  if (
    existing?.trigger_type === "schedule" &&
    existing.schedule_interval === parsed.data.schedule_interval &&
    existing.next_run_at
  ) {
    patch.next_run_at = existing.next_run_at;
  }
  const { error } = await supabase.from("workflows").update(patch).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/workflows/${id}`);
  return { ok: true };
}

export async function deleteWorkflow(id: string) {
  const { supabase } = await getContext();
  await supabase.from("workflows").delete().eq("id", id);
  revalidatePath("/workflows");
  redirect("/workflows");
}

export async function rotateWebhookToken(id: string) {
  const { supabase } = await getContext();
  const token = Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString("hex");
  await supabase.from("workflows").update({ webhook_token: token }).eq("id", id);
  revalidatePath(`/workflows/${id}`);
}

export async function startWorkflow(id: string, _: FormState, formData: FormData): Promise<FormState> {
  const { supabase, user, canEdit } = await getContext();
  if (!canEdit) return { error: "You don't have permission to run workflows." };
  const { data: wf } = await supabase.from("workflows").select("id").eq("id", id).maybeSingle();
  if (!wf) return { error: "Workflow not found" };
  let runId: string;
  try {
    runId = await createWorkflowRun(wf.id, {
      input: String(formData.get("input") ?? ""),
      trigger: "manual",
      createdBy: user.id,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to start" };
  }
  await dispatchWorkflowRun(runId);
  redirect(`/workflow-runs/${runId}`);
}

export async function decide(workflowRunId: string, approve: boolean) {
  const { supabase, user, canEdit } = await getContext();
  if (!canEdit) return;
  // RLS: the user must be able to see this run.
  const { data } = await supabase.from("workflow_runs").select("id").eq("id", workflowRunId).maybeSingle();
  if (!data) return;
  const res = await decideApproval(workflowRunId, approve, user.id);
  if (res.resumed) await dispatchWorkflowRun(workflowRunId);
  revalidatePath(`/workflow-runs/${workflowRunId}`);
  revalidatePath("/approvals");
}
