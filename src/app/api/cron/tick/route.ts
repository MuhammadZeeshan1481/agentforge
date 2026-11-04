import type { NextRequest } from "next/server";
import { tickSchedules, runWorkflowInline } from "@/lib/engine/workflow";
import { dispatchWorkflowRun, inngestEnabled } from "@/lib/engine/dispatch";
import { json, safeEqual } from "@/lib/api-auth";

export const maxDuration = 300;

/**
 * Fallback scheduler for deployments without Inngest (Vercel Cron calls this
 * with `Authorization: Bearer $CRON_SECRET`). With Inngest, the schedule-tick
 * function runs every 10 minutes instead.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return json({ error: "Unauthorized" }, 401);

  const started = await tickSchedules(async (id) => {
    if (inngestEnabled()) await dispatchWorkflowRun(id);
    else await runWorkflowInline(id);
  });
  return json({ started });
}
