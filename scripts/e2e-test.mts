/**
 * End-to-end smoke test against a real Supabase project.
 * Usage: npx tsx --conditions=react-server scripts/e2e-test.mts
 * Creates two temporary users, verifies workspace trigger + RLS,
 * runs an agent through the real engine, then deletes the users.
 */
import { createClient } from "@supabase/supabase-js";
import { executeRun } from "../src/lib/engine/run-agent";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

let failures = 0;
const check = (name: string, ok: boolean, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`);
  if (!ok) failures++;
};

async function makeUser(tag: string) {
  const email = `e2e-${tag}-${Date.now()}@agentforge.test`;
  const password = "Test-password-123!";
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const client = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error: e2 } = await client.auth.signInWithPassword({ email, password });
  if (e2) throw e2;
  return { id: data.user.id, client };
}

const users: string[] = [];
try {
  const a = await makeUser("a");
  const b = await makeUser("b");
  users.push(a.id, b.id);

  const { data: wsA } = await a.client.from("workspaces").select("*");
  check("signup trigger creates a workspace", wsA?.length === 1, wsA?.[0]?.name);
  const ws = wsA![0];

  const { data: agent, error: agentErr } = await a.client
    .from("agents")
    .insert({
      workspace_id: ws.id,
      name: "E2E time agent",
      instructions: "You answer questions about time. Always use the current_time tool.",
      tools: ["current_time"],
      max_steps: 4,
    })
    .select()
    .single();
  check("owner can create agent (RLS insert)", !!agent && !agentErr, agentErr?.message);

  const { data: bSees } = await b.client.from("agents").select("id").eq("id", agent!.id);
  check("other user cannot see agent (RLS select)", bSees?.length === 0);

  const { error: bInsert } = await b.client
    .from("agents")
    .insert({ workspace_id: ws.id, name: "intruder" });
  check("other user cannot insert into foreign workspace", !!bInsert);

  const { error: runInsertErr } = await a.client
    .from("runs")
    .insert({ workspace_id: ws.id, agent_id: agent!.id, input: "x" });
  check("users cannot insert runs directly", !!runInsertErr);

  const { error: limitErr, data: limitData } = await a.client
    .from("workspaces")
    .update({ monthly_token_limit: 999999999 })
    .eq("id", ws.id)
    .select();
  check("users cannot raise their token limit", !!limitErr || limitData?.length === 0, limitErr?.message);

  const { data: run } = await admin
    .from("runs")
    .insert({ workspace_id: ws.id, agent_id: agent!.id, input: "What time is it in Asia/Karachi right now?" })
    .select()
    .single();

  const t0 = Date.now();
  const result = await executeRun(run!.id);
  const { data: finalRun } = await a.client.from("runs").select("*").eq("id", run!.id).single();
  const { data: steps } = await a.client.from("run_steps").select("kind, content").eq("run_id", run!.id).order("id");
  check("run succeeded", finalRun?.status === "succeeded", finalRun?.error ?? JSON.stringify(result));
  check("tool was called", !!steps?.some((s) => s.kind === "tool_call" && s.content.tool === "current_time"));
  check("tokens recorded", (finalRun?.input_tokens ?? 0) > 0, `${finalRun?.input_tokens} in / ${finalRun?.output_tokens} out`);
  console.log(`      output (${Date.now() - t0} ms): ${finalRun?.output}`);
  console.log(`      steps: ${steps?.map((s) => s.kind).join(" → ")}`);

  const again = await executeRun(run!.id);
  check("re-running a finished run is skipped (idempotent)", (again as { skipped?: boolean }).skipped === true);

  const { data: bSteps } = await b.client.from("run_steps").select("id").eq("run_id", run!.id);
  check("other user cannot read run steps", bSteps?.length === 0);
} catch (err) {
  failures++;
  console.log("FAIL  unexpected error —", err instanceof Error ? err.message : err);
} finally {
  for (const id of users) await admin.auth.admin.deleteUser(id);
  console.log(`\nCleaned up ${users.length} test users. ${failures ? failures + " FAILED" : "ALL PASSED"}`);
  process.exit(failures ? 1 : 0);
}
