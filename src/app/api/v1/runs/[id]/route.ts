import type { NextRequest } from "next/server";
import { authenticateApiKey, json } from "@/lib/api-auth";
import { tooMany } from "@/lib/rate-limit";

/** GET /api/v1/runs/:id → run status, output, usage and steps */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/v1/runs/[id]">) {
  const auth = await authenticateApiKey(request);
  if (!auth) return json({ error: "Invalid or missing API key" }, 401);
  if (auth.limited) return tooMany();
  const { id } = await ctx.params;
  const { data: run } = await auth.db
    .from("runs")
    .select("id, agent_id, status, input, output, error, model, input_tokens, output_tokens, created_at, started_at, finished_at")
    .eq("id", id)
    .eq("workspace_id", auth.workspaceId)
    .maybeSingle();
  if (!run) return json({ error: "Run not found" }, 404);
  const { data: steps } = await auth.db
    .from("run_steps")
    .select("kind, content, created_at")
    .eq("run_id", id)
    .order("id");
  return json({ ...run, steps: steps ?? [] });
}
