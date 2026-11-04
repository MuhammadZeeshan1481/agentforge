import type { NextRequest } from "next/server";
import { z } from "zod";
import { authenticateApiKey, json } from "@/lib/api-auth";
import { tooMany } from "@/lib/rate-limit";
import { createWorkflowRun } from "@/lib/engine/workflow";
import { dispatchWorkflowRun } from "@/lib/engine/dispatch";

export const maxDuration = 300;
const Body = z.object({ input: z.string().max(20000).default("") });

/** POST /api/v1/workflows/:id/runs { "input": "..." } → 202 { workflow_run_id } */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/v1/workflows/[id]/runs">) {
  const auth = await authenticateApiKey(request);
  if (!auth) return json({ error: "Invalid or missing API key" }, 401);
  if (auth.limited) return tooMany();
  const { id } = await ctx.params;
  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return json({ error: parsed.error.issues[0].message }, 400);

  const { data: wf } = await auth.db
    .from("workflows")
    .select("id")
    .eq("id", id)
    .eq("workspace_id", auth.workspaceId)
    .maybeSingle();
  if (!wf) return json({ error: "Workflow not found" }, 404);
  try {
    const runId = await createWorkflowRun(wf.id, { input: parsed.data.input, trigger: "manual" });
    await dispatchWorkflowRun(runId);
    return json({ workflow_run_id: runId, status: "queued" }, 202);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Failed" }, 400);
  }
}
