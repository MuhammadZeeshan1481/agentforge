/**
 * End-to-end test for workflows, approvals, conditions, schedules, memory,
 * knowledge base, API keys and webhooks against a real Supabase project.
 *
 * Usage: npx tsx --conditions=react-server scripts/e2e-m2.mts [baseUrl]
 *   baseUrl (optional) — a running app (e.g. http://localhost:3000) to also
 *   test the webhook and public API routes over HTTP.
 */
import { createClient } from "@supabase/supabase-js";
import {
  createWorkflowRun,
  decideApproval,
  runWorkflowInline,
  tickSchedules,
} from "../src/lib/engine/workflow";
import { executeRun } from "../src/lib/engine/run-agent";
import { chunkText } from "../src/lib/knowledge";
import { generateApiKey } from "../src/lib/api-auth";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const admin = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const baseUrl = process.argv[2];

let failures = 0;
const check = (name: string, ok: boolean, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`);
  if (!ok) failures++;
};

async function makeUser(tag: string) {
  const email = `e2e2-${tag}-${Date.now()}@agentforge.test`;
  const password = "Test-password-123!";
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const client = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error: e2 } = await client.auth.signInWithPassword({ email, password });
  if (e2) throw e2;
  const { data: ws } = await client.from("workspaces").select("id").single();
  return { id: data.user.id, client, workspaceId: ws!.id as string };
}

async function runAgent(agentId: string, workspaceId: string, input: string) {
  const { data: run } = await admin.from("runs").insert({ agent_id: agentId, workspace_id: workspaceId, input }).select("id").single();
  await executeRun(run!.id);
  const { data } = await admin.from("runs").select("status, output, error").eq("id", run!.id).single();
  return data!;
}

const users: string[] = [];
try {
  const a = await makeUser("a");
  const b = await makeUser("b");
  users.push(a.id, b.id);
  const ws = a.workspaceId;

  const mkAgent = async (name: string, instructions: string, tools: string[]) => {
    const { data, error } = await a.client
      .from("agents")
      .insert({ workspace_id: ws, name, instructions, tools, max_steps: 5 })
      .select("id")
      .single();
    if (error) throw error;
    return data.id as string;
  };

  // ── Memory ──────────────────────────────────────────────
  const memAgent = await mkAgent(
    "Memory agent",
    "When the user tells you a fact about themselves, ALWAYS save it with save_memory, then confirm briefly. Answer questions using what you remember.",
    ["memory"],
  );
  const m1 = await runAgent(memAgent, ws, "Please remember this: my favorite color is teal.");
  const { data: mems } = await a.client.from("agent_memories").select("content").eq("agent_id", memAgent);
  check("memory: agent saved a memory", m1.status === "succeeded" && (mems?.length ?? 0) > 0, mems?.[0]?.content);
  const m2 = await runAgent(memAgent, ws, "What is my favorite color? One word.");
  check("memory: recalled in a later run", (m2.output ?? "").toLowerCase().includes("teal"), m2.output ?? m2.error ?? "");
  const { data: bMems } = await b.client.from("agent_memories").select("id").eq("agent_id", memAgent);
  check("memory: other workspace can't read it", bMems?.length === 0);

  // ── Knowledge base ─────────────────────────────────────
  const content =
    "Acme Refund Policy.\n\nCustomers can request a full refund within 30 days of purchase. " +
    "Refunds are processed in 5 business days. Digital gift cards are not refundable.\n\n" +
    "Shipping: orders ship within 2 days from our Lahore warehouse.";
  const { data: doc } = await admin.from("knowledge_docs").insert({ workspace_id: ws, title: "Refund policy", content }).select("id").single();
  await admin.from("knowledge_chunks").insert(
    chunkText(content).map((c, i) => ({ doc_id: doc!.id, workspace_id: ws, chunk_index: i, content: c })),
  );
  const kbAgent = await mkAgent(
    "Support agent",
    "Always use search_knowledge before answering. Answer only from the results.",
    ["search_knowledge"],
  );
  const k = await runAgent(kbAgent, ws, "How many days do I have to request a refund?");
  check("knowledge: answer comes from the document", (k.output ?? "").includes("30"), k.output ?? k.error ?? "");
  const { error: rpcErr } = await b.client.rpc("search_knowledge", { ws, query: "refund", match_count: 5 });
  check("knowledge: users can't call the search RPC directly", !!rpcErr, rpcErr?.message);
  const { data: bDocs } = await b.client.from("knowledge_docs").select("id").eq("workspace_id", ws);
  check("knowledge: other workspace can't read docs", bDocs?.length === 0);

  // ── Workflow: agent → approval → condition → agent ─────
  const writer = await mkAgent("Writer", "Write exactly one short sentence about the topic you are given. Include the word ORBIT.", []);
  const shouter = await mkAgent("Shouter", "Rewrite the text you are given in ALL CAPS. Output only the rewritten text.", []);
  const { data: wf, error: wfErr } = await a.client
    .from("workflows")
    .insert({
      workspace_id: ws,
      name: "Write → approve → check → shout",
      steps: [
        { type: "agent", agent_id: writer, input: "Topic: {{input}}" },
        { type: "approval", message: "Approve this draft: {{previous}}" },
        { type: "condition", mode: "contains", value: "orbit" },
        { type: "agent", agent_id: shouter, input: "{{previous}}" },
      ],
    })
    .select("*")
    .single();
  check("workflow: editor can create a workflow (RLS)", !!wf && !wfErr, wfErr?.message);

  const wr1 = await createWorkflowRun(wf!.id, { input: "the moon", trigger: "manual", createdBy: a.id });
  await runWorkflowInline(wr1);
  let { data: s1 } = await a.client.from("workflow_runs").select("*").eq("id", wr1).single();
  check("workflow: pauses at approval step", s1?.status === "waiting_approval" && s1.current_step === 1, s1?.approval_message?.slice(0, 80));

  const dec = await decideApproval(wr1, true, a.id);
  check("workflow: approve re-queues the run", dec.resumed === true);
  await runWorkflowInline(wr1);
  ({ data: s1 } = await a.client.from("workflow_runs").select("*").eq("id", wr1).single());
  const outs = s1?.outputs as { status: string; output?: string }[];
  check(
    "workflow: finishes all 4 steps",
    s1?.status === "succeeded" && outs?.length === 4 && outs.map((o) => o.status).join(",") === "succeeded,approved,passed,succeeded",
    outs?.map((o) => o.status).join(","),
  );
  check("workflow: last step received previous output", (s1?.output ?? "") === (s1?.output ?? "").toUpperCase() && (s1?.output ?? "").includes("ORBIT"), s1?.output ?? "");

  const { count: childRuns } = await admin.from("runs").select("id", { count: "exact", head: true }).eq("workflow_run_id", wr1);
  check("workflow: agent runs are linked to the workflow run", childRuns === 2, String(childRuns));

  // Reject path
  const wr2 = await createWorkflowRun(wf!.id, { input: "the sun", trigger: "manual" });
  await runWorkflowInline(wr2);
  await decideApproval(wr2, false, a.id);
  const { data: s2 } = await admin.from("workflow_runs").select("status, error").eq("id", wr2).single();
  check("workflow: reject fails the run", s2?.status === "failed" && s2.error === "Rejected by reviewer");

  // Condition stops
  const { data: wfCond } = await a.client
    .from("workflows")
    .insert({
      workspace_id: ws,
      name: "condition stop",
      steps: [
        { type: "agent", agent_id: writer, input: "{{input}}" },
        { type: "condition", mode: "contains", value: "zebra-never-appears" },
        { type: "agent", agent_id: shouter, input: "{{previous}}" },
      ],
    })
    .select("id")
    .single();
  const wr3 = await createWorkflowRun(wfCond!.id, { input: "stars", trigger: "manual" });
  await runWorkflowInline(wr3);
  const { data: s3 } = await admin.from("workflow_runs").select("status, outputs").eq("id", wr3).single();
  const o3 = s3?.outputs as { status: string }[];
  check("workflow: unmet condition stops early", s3?.status === "succeeded" && o3.length === 2 && o3[1].status === "stopped");

  // Users can't write workflow runs directly; other users can't see the workflow
  const { error: wrInsertErr } = await a.client
    .from("workflow_runs")
    .insert({ workspace_id: ws, workflow_id: wf!.id, steps: [] });
  check("workflow: users can't insert workflow runs directly", !!wrInsertErr);
  const { data: bWf } = await b.client.from("workflows").select("id").eq("id", wf!.id);
  check("workflow: other workspace can't see it", bWf?.length === 0);

  // ── Schedule ───────────────────────────────────────────
  const past = new Date(Date.now() - 60_000).toISOString();
  const { data: wfSched } = await admin
    .from("workflows")
    .insert({
      workspace_id: ws,
      name: "scheduled",
      steps: [{ type: "agent", agent_id: writer, input: "{{input}}" }],
      trigger_type: "schedule",
      schedule_interval: "daily",
      schedule_input: "comets",
      next_run_at: past,
    })
    .select("id")
    .single();
  const started = await tickSchedules(async (id) => runWorkflowInline(id));
  const { data: schedRuns } = await admin.from("workflow_runs").select("status, trigger").eq("workflow_id", wfSched!.id);
  const { data: wfAfter } = await admin.from("workflows").select("next_run_at").eq("id", wfSched!.id).single();
  check(
    "schedule: due workflow ran and next_run_at moved ~1 day ahead",
    started >= 1 && schedRuns?.[0]?.status === "succeeded" && schedRuns[0].trigger === "schedule" &&
      new Date(wfAfter!.next_run_at).getTime() > Date.now() + 23 * 3600_000,
  );
  const again = await tickSchedules(async (id) => runWorkflowInline(id));
  check("schedule: not run twice", again === 0);

  // ── HTTP: webhook + public API ─────────────────────────
  if (baseUrl) {
    await admin.from("workflows").update({ trigger_type: "webhook" }).eq("id", wfCond!.id);
    const { data: hookWf } = await admin.from("workflows").select("webhook_token").eq("id", wfCond!.id).single();
    const bad = await fetch(`${baseUrl}/api/hooks/${wfCond!.id}?token=wrong`, { method: "POST", body: "x" });
    check("webhook: wrong token rejected", bad.status === 404);
    const ok = await fetch(`${baseUrl}/api/hooks/${wfCond!.id}?token=${hookWf!.webhook_token}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ topic: "planets" }),
    });
    const okBody = await ok.json();
    check("webhook: valid token starts a run", ok.status === 202 && !!okBody.workflow_run_id, JSON.stringify(okBody));

    const { key, prefix, hash } = generateApiKey();
    await admin.from("api_keys").insert({ workspace_id: ws, name: "e2e", prefix, key_hash: hash });
    const noKey = await fetch(`${baseUrl}/api/v1/agents/${writer}/runs`, { method: "POST", body: "{}" });
    check("api: missing key rejected", noKey.status === 401);
    const start = await fetch(`${baseUrl}/api/v1/agents/${writer}/runs`, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ input: "rockets" }),
    });
    const { run_id } = await start.json();
    check("api: start agent run", start.status === 202 && !!run_id);
    let status = "";
    for (let i = 0; i < 30 && !["succeeded", "failed"].includes(status); i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const res = await fetch(`${baseUrl}/api/v1/runs/${run_id}`, { headers: { authorization: `Bearer ${key}` } });
      status = (await res.json()).status;
    }
    check("api: poll run until finished", status === "succeeded", status);

    // Another workspace's key can't touch this agent
    const other = generateApiKey();
    await admin.from("api_keys").insert({ workspace_id: b.workspaceId, name: "e2e-b", prefix: other.prefix, key_hash: other.hash });
    const cross = await fetch(`${baseUrl}/api/v1/agents/${writer}/runs`, {
      method: "POST",
      headers: { authorization: `Bearer ${other.key}`, "content-type": "application/json" },
      body: "{}",
    });
    check("api: key from another workspace gets 404", cross.status === 404);
  }
} catch (err) {
  failures++;
  console.log("FAIL  unexpected error —", err instanceof Error ? err.message : err);
} finally {
  for (const id of users) await admin.auth.admin.deleteUser(id);
  console.log(`\nCleaned up ${users.length} test users. ${failures ? failures + " FAILED" : "ALL PASSED"}`);
  process.exit(failures ? 1 : 0);
}
