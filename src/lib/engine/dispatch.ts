import "server-only";
import { after } from "next/server";
import { inngest } from "@/inngest/client";
import { executeRun } from "./run-agent";
import { runWorkflowInline } from "./workflow";

/**
 * Background execution. Uses Inngest when configured (production:
 * INNGEST_EVENT_KEY, local: INNGEST_DEV=1). Otherwise runs after the response
 * with next/server `after()` — fine for demos, limited by the function's max duration.
 */
export const inngestEnabled = () => !!(process.env.INNGEST_EVENT_KEY || process.env.INNGEST_DEV);

export async function dispatchRun(runId: string) {
  if (inngestEnabled()) {
    await inngest.send({ name: "agent/run.requested", data: { runId } });
    return;
  }
  after(async () => {
    await executeRun(runId);
  });
}

export async function dispatchWorkflowRun(workflowRunId: string) {
  if (inngestEnabled()) {
    await inngest.send({ name: "workflow/run.requested", data: { workflowRunId } });
    return;
  }
  after(async () => {
    await runWorkflowInline(workflowRunId);
  });
}
