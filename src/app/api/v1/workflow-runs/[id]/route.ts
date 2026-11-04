import type { NextRequest } from "next/server";
import { authenticateApiKey, json } from "@/lib/api-auth";
import { tooMany } from "@/lib/rate-limit";

/** GET /api/v1/workflow-runs/:id → status, per-step outputs, final output */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/v1/workflow-runs/[id]">) {
  const auth = await authenticateApiKey(request);
  if (!auth) return json({ error: "Invalid or missing API key" }, 401);
  if (auth.limited) return tooMany();
  const { id } = await ctx.params;
  const { data } = await auth.db
    .from("workflow_runs")
    .select("id, workflow_id, status, trigger, input, current_step, outputs, output, error, approval_message, created_at, started_at, finished_at")
    .eq("id", id)
    .eq("workspace_id", auth.workspaceId)
    .maybeSingle();
  if (!data) return json({ error: "Workflow run not found" }, 404);
  return json(data);
}
