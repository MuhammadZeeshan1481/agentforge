import { inngest } from "./client";
import { executeRun } from "@/lib/engine/run-agent";
import {
  advanceWorkflowOneStep,
  claimWorkflowRun,
  tickSchedules,
} from "@/lib/engine/workflow";

export const runAgent = inngest.createFunction(
  { id: "run-agent", retries: 2, concurrency: { limit: 5 } },
  { event: "agent/run.requested" },
  async ({ event, step }) => {
    return step.run("execute-run", () => executeRun(event.data.runId as string));
  },
);

export const runWorkflow = inngest.createFunction(
  { id: "run-workflow", retries: 1, concurrency: { limit: 5 } },
  { event: "workflow/run.requested" },
  async ({ event, step }) => {
    const id = event.data.workflowRunId as string;
    const claimed = await step.run("claim", () => claimWorkflowRun(id));
    if (!claimed) return { skipped: true };
    // One Inngest step per workflow step: each is checkpointed and gets its own time budget.
    for (let n = 0; n < 50; n++) {
      const { done } = await step.run(`step-${n}`, () => advanceWorkflowOneStep(id));
      if (done) break;
    }
    return { ok: true };
  },
);

export const scheduleTick = inngest.createFunction(
  { id: "schedule-tick" },
  { cron: "*/10 * * * *" },
  async ({ step }) => {
    const started = await step.run("start-due-workflows", () =>
      tickSchedules(async (workflowRunId) => {
        await inngest.send({ name: "workflow/run.requested", data: { workflowRunId } });
      }),
    );
    return { started };
  },
);

export const functions = [runAgent, runWorkflow, scheduleTick];
