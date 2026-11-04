// Shared (client + server) workflow types and helpers.
export type AgentStep = { type: "agent"; agent_id: string; input: string };
export type ApprovalStep = { type: "approval"; message: string };
export type ConditionStep = { type: "condition"; mode: "contains" | "not_contains"; value: string };
export type WorkflowStep = AgentStep | ApprovalStep | ConditionStep;

export type StepOutput = {
  type: WorkflowStep["type"];
  status: "succeeded" | "failed" | "approved" | "rejected" | "passed" | "stopped";
  output?: string;
  run_id?: string;
  note?: string;
};

export const SCHEDULE_INTERVALS = {
  hourly: 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
} as const;
export type ScheduleInterval = keyof typeof SCHEDULE_INTERVALS;

/**
 * Template variables:
 *   {{input}}     the workflow run's input
 *   {{previous}}  output of the previous agent step (or the input for the first step)
 *   {{step1}} …   output of step N (1-based)
 */
export function renderTemplate(template: string, input: string, outputs: StepOutput[]) {
  const lastAgent = [...outputs].reverse().find((o) => o.type === "agent" && o.output != null);
  const previous = lastAgent?.output ?? input;
  return (template || "{{previous}}")
    .replaceAll("{{input}}", input)
    .replaceAll("{{previous}}", previous)
    .replace(/\{\{step(\d+)\}\}/g, (_, n) => outputs[Number(n) - 1]?.output ?? "");
}

export function stepLabel(step: WorkflowStep, agentNames: Record<string, string> = {}) {
  if (step.type === "agent") return `Agent: ${agentNames[step.agent_id] ?? "unknown agent"}`;
  if (step.type === "approval") return "Human approval";
  return `Condition: output ${step.mode === "contains" ? "contains" : "does not contain"} “${step.value}”`;
}
