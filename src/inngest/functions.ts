import { inngest } from "./client";
import { executeRun } from "@/lib/engine/run-agent";

export const runAgent = inngest.createFunction(
  { id: "run-agent", retries: 2, concurrency: { limit: 5 } },
  { event: "agent/run.requested" },
  async ({ event, step }) => {
    return step.run("execute-run", () => executeRun(event.data.runId as string));
  },
);

export const functions = [runAgent];
