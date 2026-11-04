import type { NextRequest } from "next/server";
import { z } from "zod";
import { authenticateApiKey, json } from "@/lib/api-auth";
import { tooMany } from "@/lib/rate-limit";
import { dispatchRun } from "@/lib/engine/dispatch";

export const maxDuration = 300;
const Body = z.object({ input: z.string().max(20000).default("") });

/** POST /api/v1/agents/:id/runs  { "input": "..." }  → 202 { run_id } */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/v1/agents/[id]/runs">) {
  const auth = await authenticateApiKey(request);
  if (!auth) return json({ error: "Invalid or missing API key" }, 401);
  if (auth.limited) return tooMany();
  const { id } = await ctx.params;
  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return json({ error: parsed.error.issues[0].message }, 400);

  const { data: agent } = await auth.db
    .from("agents")
    .select("id, workspace_id")
    .eq("id", id)
    .eq("workspace_id", auth.workspaceId)
    .maybeSingle();
  if (!agent) return json({ error: "Agent not found" }, 404);

  const { data: run, error } = await auth.db
    .from("runs")
    .insert({ agent_id: agent.id, workspace_id: agent.workspace_id, input: parsed.data.input })
    .select("id")
    .single();
  if (error) return json({ error: error.message }, 500);
  await dispatchRun(run.id);
  return json({ run_id: run.id, status: "queued" }, 202);
}
