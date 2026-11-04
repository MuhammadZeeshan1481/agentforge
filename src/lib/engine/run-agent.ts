import "server-only";
import { generateText, stepCountIs } from "ai";
import { google } from "@ai-sdk/google";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildToolSet } from "@/lib/tools/registry";
import { DEFAULT_MODEL, MODELS } from "@/lib/tools/catalog";

const ALLOWED_MODELS = new Set<string>(MODELS.map((m) => m.id));
const MAX_LOG_CHARS = 4000;

function trimForLog(value: unknown): unknown {
  const s = typeof value === "string" ? value : JSON.stringify(value ?? null);
  if (s.length <= MAX_LOG_CHARS) return value;
  return s.slice(0, MAX_LOG_CHARS) + "…[truncated]";
}

/**
 * Executes one queued run end-to-end and records every step in run_steps.
 * Idempotent: a run that is no longer 'queued' is skipped (safe for retries).
 */
export type RunResult = { ok?: boolean; skipped?: boolean; error?: string; output?: string };

export async function executeRun(runId: string): Promise<RunResult> {
  const db = createAdminClient();

  // Claim the run atomically so a retry/duplicate event can't run it twice.
  const { data: run } = await db
    .from("runs")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("id", runId)
    .eq("status", "queued")
    .select("id, workspace_id, agent_id, input")
    .maybeSingle();
  if (!run) return { skipped: true };

  const log = (kind: string, content: Record<string, unknown>) =>
    db.from("run_steps").insert({ run_id: run.id, workspace_id: run.workspace_id, kind, content });

  const fail = async (message: string) => {
    await log("error", { message });
    await db
      .from("runs")
      .update({ status: "failed", error: message, finished_at: new Date().toISOString() })
      .eq("id", run.id);
    return { ok: false, error: message };
  };

  const { data: agent } = await db.from("agents").select("*").eq("id", run.agent_id).single();
  if (!agent) return fail("Agent not found");

  // Monthly token budget per workspace
  const { data: ws } = await db
    .from("workspaces")
    .select("monthly_token_limit")
    .eq("id", run.workspace_id)
    .single();
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const { data: usageRows } = await db
    .from("runs")
    .select("input_tokens, output_tokens")
    .eq("workspace_id", run.workspace_id)
    .gte("created_at", monthStart.toISOString());
  const used = (usageRows ?? []).reduce((n, r) => n + r.input_tokens + r.output_tokens, 0);
  if (ws && used >= ws.monthly_token_limit) {
    return fail(`Monthly token limit reached (${used}/${ws.monthly_token_limit}).`);
  }

  const modelId = ALLOWED_MODELS.has(agent.model) ? agent.model : DEFAULT_MODEL;
  await db.from("runs").update({ model: modelId }).eq("id", run.id);
  await log("info", { message: `Starting ${agent.name} on ${modelId}`, tools: agent.tools });

  const tools = buildToolSet(agent.tools ?? [], agent.tool_config ?? {}, {
    db,
    workspaceId: run.workspace_id,
    agentId: agent.id,
    runId: run.id,
  });

  let memoryBlock = "";
  if ((agent.tools ?? []).includes("memory")) {
    const { data: memories } = await db
      .from("agent_memories")
      .select("content")
      .eq("agent_id", agent.id)
      .order("created_at", { ascending: false })
      .limit(30);
    if (memories?.length) {
      memoryBlock = [
        "",
        "Things you remember from previous runs (most recent first):",
        ...memories.map((m) => `- ${m.content}`),
      ].join("\n");
      await log("info", { message: `Loaded ${memories.length} memories` });
    }
  }
  let finalText = "";
  let inTokens = 0;
  let outTokens = 0;

  const isOverloaded = (e: unknown) =>
    /high demand|overloaded|unavailable|503|429|resource exhausted/i.test(e instanceof Error ? e.message : String(e));

  try {
    const generate = (id: string) => generateText({
      model: google(id),
      system: [
        agent.instructions || "You are a helpful assistant.",
        memoryBlock,
        "",
        "Use the available tools when they help. When finished, reply with the final answer only.",
      ].join("\n"),
      prompt: run.input || "Start.",
      tools,
      stopWhen: stepCountIs(agent.max_steps ?? 8),
      maxRetries: 3,
      onStepFinish: async (step) => {
        for (const call of step.toolCalls) {
          await log("tool_call", { tool: call.toolName, input: trimForLog(call.input) });
        }
        for (const res of step.toolResults) {
          await log("tool_result", { tool: res.toolName, output: trimForLog(res.output) });
        }
        if (step.text) await log("llm", { text: trimForLog(step.text) });
        // Running token total, so the UI shows usage while the run is in progress.
        inTokens += step.usage.inputTokens ?? 0;
        outTokens += step.usage.outputTokens ?? 0;
        await db
          .from("runs")
          .update({ input_tokens: inTokens, output_tokens: outTokens })
          .eq("id", run.id);
      },
    });

    let usedModel = modelId;
    let result;
    try {
      result = await generate(modelId);
    } catch (e) {
      // Graceful degradation: if the chosen model is overloaded, retry once on the default model.
      if (modelId === DEFAULT_MODEL || !isOverloaded(e) || inTokens + outTokens > 0) throw e;
      usedModel = DEFAULT_MODEL;
      await log("info", { message: `${modelId} is overloaded — retrying on ${DEFAULT_MODEL}` });
      await db.from("runs").update({ model: usedModel }).eq("id", run.id);
      result = await generate(usedModel);
    }

    const reachedLimit =
      result.steps.length >= (agent.max_steps ?? 8) && result.finishReason === "tool-calls";

    await db
      .from("runs")
      .update({
        status: "succeeded",
        output: result.text || (reachedLimit ? "(Stopped: step limit reached)" : ""),
        input_tokens: result.totalUsage.inputTokens ?? 0,
        output_tokens: result.totalUsage.outputTokens ?? 0,
        finished_at: new Date().toISOString(),
      })
      .eq("id", run.id);
    finalText = result.text;
    await log("info", {
      message: reachedLimit ? "Stopped at step limit" : "Finished",
      steps: result.steps.length,
      usage: result.totalUsage,
    });
    return { ok: true, output: finalText };
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err));
  }
}
