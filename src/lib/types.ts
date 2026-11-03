export type Agent = {
  id: string;
  workspace_id: string;
  name: string;
  description: string;
  instructions: string;
  model: string;
  tools: string[];
  tool_config: Record<string, Record<string, string>>;
  max_steps: number;
  created_at: string;
  updated_at: string;
};

export type RunStatus = "queued" | "running" | "succeeded" | "failed";

export type Run = {
  id: string;
  workspace_id: string;
  agent_id: string;
  status: RunStatus;
  input: string;
  output: string | null;
  error: string | null;
  model: string | null;
  input_tokens: number;
  output_tokens: number;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
};

export type RunStep = {
  id: number;
  run_id: string;
  kind: "info" | "llm" | "tool_call" | "tool_result" | "error";
  content: Record<string, unknown>;
  created_at: string;
};
