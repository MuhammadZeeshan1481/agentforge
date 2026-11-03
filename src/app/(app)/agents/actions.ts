"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getContext } from "@/lib/workspace";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchRun } from "@/lib/engine/dispatch";
import { MODELS, TOOL_IDS } from "@/lib/tools/catalog";

export type FormState = { error?: string; ok?: boolean };

const AgentInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  description: z.string().trim().max(500).default(""),
  instructions: z.string().max(20000).default(""),
  model: z.enum(MODELS.map((m) => m.id) as [string, ...string[]]),
  max_steps: z.coerce.number().int().min(1).max(25),
  tools: z.array(z.enum(TOOL_IDS as [string, ...string[]])).default([]),
  slack_webhook_url: z
    .string()
    .trim()
    .refine((v) => v === "" || /^https:\/\/hooks\.slack\.com\//.test(v), {
      message: "Slack webhook must start with https://hooks.slack.com/",
    })
    .default(""),
});

function parseAgent(formData: FormData) {
  const parsed = AgentInput.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    instructions: formData.get("instructions") ?? "",
    model: formData.get("model"),
    max_steps: formData.get("max_steps"),
    tools: formData.getAll("tools"),
    slack_webhook_url: formData.get("slack_webhook_url") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message } as const;
  const { slack_webhook_url, ...rest } = parsed.data;
  return {
    data: {
      ...rest,
      tool_config: slack_webhook_url ? { slack_post: { webhook_url: slack_webhook_url } } : {},
    },
  } as const;
}

export async function createAgent(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, user, workspace } = await getContext();
  const parsed = parseAgent(formData);
  if ("error" in parsed) return { error: parsed.error };

  const { data, error } = await supabase
    .from("agents")
    .insert({ ...parsed.data, workspace_id: workspace.id, created_by: user.id })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/agents");
  redirect(`/agents/${data.id}`);
}

export async function updateAgent(
  agentId: string,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase } = await getContext();
  const parsed = parseAgent(formData);
  if ("error" in parsed) return { error: parsed.error };

  const { error } = await supabase
    .from("agents")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", agentId);
  if (error) return { error: error.message };
  revalidatePath(`/agents/${agentId}`);
  revalidatePath("/agents");
  return { ok: true };
}

export async function deleteAgent(agentId: string) {
  const { supabase } = await getContext();
  await supabase.from("agents").delete().eq("id", agentId);
  revalidatePath("/agents");
  redirect("/agents");
}

export async function startRun(agentId: string, _: FormState, formData: FormData): Promise<FormState> {
  const { supabase, user, role } = await getContext();
  if (!["owner", "admin", "editor"].includes(role)) return { error: "You don't have permission to run agents." };

  const input = String(formData.get("input") ?? "").slice(0, 20000);

  // RLS check: the user must be able to see this agent.
  const { data: agent } = await supabase
    .from("agents")
    .select("id, workspace_id")
    .eq("id", agentId)
    .maybeSingle();
  if (!agent) return { error: "Agent not found" };

  // Runs are written by the server only (users have no insert grant on runs).
  const admin = createAdminClient();
  const { data: run, error } = await admin
    .from("runs")
    .insert({ agent_id: agent.id, workspace_id: agent.workspace_id, input, created_by: user.id })
    .select("id")
    .single();
  if (error) return { error: error.message };

  await dispatchRun(run.id);
  redirect(`/runs/${run.id}`);
}
