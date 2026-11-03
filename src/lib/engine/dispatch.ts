import "server-only";
import { after } from "next/server";
import { inngest } from "@/inngest/client";
import { executeRun } from "./run-agent";

/**
 * Queue a run. Uses Inngest when configured (production: INNGEST_EVENT_KEY,
 * local: INNGEST_DEV=1). Otherwise falls back to running in the background
 * of the current request with next/server `after()` — fine for demos, but
 * limited by the hosting function's max duration.
 */
export async function dispatchRun(runId: string) {
  if (process.env.INNGEST_EVENT_KEY || process.env.INNGEST_DEV) {
    await inngest.send({ name: "agent/run.requested", data: { runId } });
    return;
  }
  after(async () => {
    await executeRun(runId);
  });
}
