import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createWorkflowRun } from "@/lib/engine/workflow";
import { dispatchWorkflowRun } from "@/lib/engine/dispatch";
import { json, safeEqual } from "@/lib/api-auth";
import { LIMITS, rateLimit, tooMany } from "@/lib/rate-limit";

export const maxDuration = 300;

/**
 * Webhook trigger. POST any body (JSON or text) to
 *   /api/hooks/<workflowId>?token=<webhook token>
 * (or send the token in the `x-agentforge-token` header).
 * The raw body becomes the workflow run's {{input}}.
 */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/hooks/[workflowId]">) {
  const { workflowId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(workflowId)) return json({ error: "Not found" }, 404);
  const token =
    request.headers.get("x-agentforge-token") ?? request.nextUrl.searchParams.get("token") ?? "";

  const db = createAdminClient();
  const { data: wf } = await db
    .from("workflows")
    .select("id, webhook_token, trigger_type, enabled")
    .eq("id", workflowId)
    .maybeSingle();
  if (!wf || !token || !safeEqual(token, wf.webhook_token)) return json({ error: "Not found" }, 404);
  if (wf.trigger_type !== "webhook") return json({ error: "Webhook trigger is not enabled for this workflow" }, 400);
  if (!wf.enabled) return json({ error: "Workflow is disabled" }, 400);

  if (!(await rateLimit(`hook:${wf.id}`, LIMITS.webhookPerWorkflow))) return tooMany();
  const body = (await request.text()).slice(0, 20000);
  try {
    const id = await createWorkflowRun(wf.id, { input: body, trigger: "webhook" });
    await dispatchWorkflowRun(id);
    return json({ workflow_run_id: id, status: "queued" }, 202);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Failed" }, 400);
  }
}
