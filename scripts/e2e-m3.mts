/**
 * End-to-end test for profiles, semantic search, rate limiting, encrypted
 * OAuth connections, PDF extraction and graceful tool failures.
 * Usage: npx tsx --conditions=react-server scripts/e2e-m3.mts
 */
import { createClient } from "@supabase/supabase-js";
import { chunkText } from "../src/lib/knowledge";
import { embedDocuments, embedQuery, toVector } from "../src/lib/embeddings";
import { rateLimit } from "../src/lib/rate-limit";
import { decrypt, encrypt } from "../src/lib/crypto";
import { getAccessToken } from "../src/lib/integrations/oauth";
import { executeRun } from "../src/lib/engine/run-agent";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const admin = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

let failures = 0;
const check = (name: string, ok: boolean, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`);
  if (!ok) failures++;
};

async function makeUser(tag: string, fullName: string) {
  const email = `e2e3-${tag}-${Date.now()}@agentforge.test`;
  const password = "Test-password-123!";
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName } });
  if (error) throw error;
  const client = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error: e2 } = await client.auth.signInWithPassword({ email, password });
  if (e2) throw e2;
  const { data: ws } = await client.from("workspaces").select("id, name").single();
  return { id: data.user.id, client, workspaceId: ws!.id as string, workspaceName: ws!.name as string };
}

/** Tiny valid PDF with one line of text. */
function makePdf(text: string) {
  const stream = `BT /F1 18 Tf 72 720 Td (${text}) Tj ET`;
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("")}`;
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Uint8Array(Buffer.from(pdf, "latin1"));
}

const users: string[] = [];
try {
  const a = await makeUser("a", "Ayesha Khan");
  const b = await makeUser("b", "Bilal Ahmed");
  users.push(a.id, b.id);

  // ── Profiles ───────────────────────────────────────────
  const { data: prof } = await a.client.from("profiles").select("full_name, onboarded").single();
  check("profile created from signup metadata", prof?.full_name === "Ayesha Khan" && prof.onboarded === false, JSON.stringify(prof));
  check("workspace named after the user", a.workspaceName === "Ayesha Khan's workspace", a.workspaceName);
  const { data: bSees } = await b.client.from("profiles").select("id").eq("id", a.id);
  check("profiles are private", bSees?.length === 0);
  const { error: upd } = await a.client.from("profiles").update({ onboarded: true, full_name: "Ayesha K." }).eq("id", a.id);
  check("user can update own profile", !upd, upd?.message);
  const { data: members } = await a.client.from("workspace_members").select("email").eq("workspace_id", a.workspaceId);
  check("member email stored", !!members?.[0]?.email?.startsWith("e2e3-a-"));

  // ── Semantic search ────────────────────────────────────
  const docs = [
    { title: "Returns", content: "Customers may send purchases back within thirty days to receive a complete reimbursement to their original card." },
    { title: "Shipping", content: "Parcels leave our Lahore warehouse within two business days and arrive in three to five days." },
    { title: "Careers", content: "We are hiring frontend engineers who love TypeScript and design systems." },
  ];
  for (const d of docs) {
    const { data: doc } = await admin.from("knowledge_docs").insert({ workspace_id: a.workspaceId, title: d.title, content: d.content }).select("id").single();
    const chunks = chunkText(d.content);
    const emb = await embedDocuments(chunks);
    await admin.from("knowledge_chunks").insert(chunks.map((c, i) => ({ doc_id: doc!.id, workspace_id: a.workspaceId, chunk_index: i, content: c, embedding: toVector(emb[i]) })));
  }
  // No shared keywords with the Returns doc — only semantic search can find it.
  const q = "how long do I have to get my money back?";
  const { data: hits, error: hErr } = await admin.rpc("search_knowledge_hybrid", { ws: a.workspaceId, query: q, query_embedding: toVector(await embedQuery(q)), match_count: 3 });
  check("semantic search finds a paraphrased answer", !hErr && hits?.[0]?.title === "Returns", hErr?.message ?? hits?.map((h: { title: string }) => h.title).join(", "));
  const { data: kw } = await admin.rpc("search_knowledge", { ws: a.workspaceId, query: q, match_count: 3 });
  check("(keyword-only search alone would miss it)", (kw?.length ?? 0) === 0, `${kw?.length ?? 0} keyword hits`);
  const { error: rpcErr } = await a.client.rpc("search_knowledge_hybrid", { ws: a.workspaceId, query: q, query_embedding: toVector(await embedQuery(q)), match_count: 3 });
  check("users can't call hybrid search RPC directly", !!rpcErr);
  const { data: bHits } = await admin.rpc("search_knowledge_hybrid", { ws: b.workspaceId, query: q, query_embedding: toVector(await embedQuery(q)), match_count: 3 });
  check("search is scoped to the workspace", (bHits?.length ?? 0) === 0);

  const { data: agent } = await a.client
    .from("agents")
    .insert({ workspace_id: a.workspaceId, name: "Support", instructions: "Always use search_knowledge first. Answer in one short sentence from the results only.", tools: ["search_knowledge"], max_steps: 4 })
    .select("id")
    .single();
  const { data: run } = await admin.from("runs").insert({ workspace_id: a.workspaceId, agent_id: agent!.id, input: "If I don't like my order, how many days until I can no longer get a refund?" }).select("id").single();
  await executeRun(run!.id);
  const { data: r } = await admin.from("runs").select("status, output").eq("id", run!.id).single();
  check("agent answers from semantic knowledge", r?.status === "succeeded" && /30|thirty/i.test(r.output ?? ""), r?.output ?? "");

  // ── Rate limiting ──────────────────────────────────────
  const bucket = `e2e:${Date.now()}`;
  const results = [];
  for (let i = 0; i < 4; i++) results.push(await rateLimit(bucket, 3, 60));
  check("rate limit allows 3 then blocks", results.join(",") === "true,true,true,false", results.join(","));
  const { error: rlErr } = await a.client.rpc("rate_limit_hit", { bucket: "x", window_seconds: 60, max_hits: 1 });
  check("users can't call the rate limiter", !!rlErr);

  // ── Encryption + connections ───────────────────────────
  const secret = "ya29.test-token";
  const enc = encrypt(secret);
  check("AES-GCM round trip", decrypt(enc) === secret && !enc.includes(secret));
  let tamper = false;
  try {
    decrypt(enc.slice(0, -2) + (enc.endsWith("A") ? "B" : "A") + enc.slice(-1));
  } catch {
    tamper = true;
  }
  check("tampered ciphertext is rejected", tamper);

  await admin.from("connections").insert({
    workspace_id: a.workspaceId,
    provider: "notion",
    account_label: "Test Notion",
    access_token_enc: encrypt("notion-secret-token"),
  });
  const { data: safeCols, error: safeErr } = await a.client.from("connections").select("provider, account_label").eq("workspace_id", a.workspaceId);
  check("members can see a connection exists", !safeErr && safeCols?.[0]?.account_label === "Test Notion", safeErr?.message);
  const { error: tokErr } = await a.client.from("connections").select("access_token_enc").eq("workspace_id", a.workspaceId);
  check("members can't read token columns", !!tokErr, tokErr?.message);
  const { data: bConn } = await b.client.from("connections").select("provider").eq("workspace_id", a.workspaceId);
  check("other workspace can't see connections", bConn?.length === 0);
  check("server can decrypt the stored token", (await getAccessToken(a.workspaceId, "notion")) === "notion-secret-token");
  let notConnected = "";
  try {
    await getAccessToken(a.workspaceId, "google");
  } catch (e) {
    notConnected = (e as Error).message;
  }
  check("clear error when an integration isn't connected", notConnected.includes("not connected"), notConnected);

  // ── PDF extraction ─────────────────────────────────────
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(makePdf("AgentForge PDF ingestion works"));
  const { text } = await extractText(pdf, { mergePages: true });
  check("PDF text extraction", String(text).includes("AgentForge PDF ingestion works"), String(text).slice(0, 60));

  // ── Graceful tool failure (email not configured) ───────
  const { data: mailer } = await a.client
    .from("agents")
    .insert({ workspace_id: a.workspaceId, name: "Mailer", instructions: "Send the email the user asks for with send_email, then report whether it was sent.", tools: ["send_email"], max_steps: 3 })
    .select("id")
    .single();
  const { data: run2 } = await admin.from("runs").insert({ workspace_id: a.workspaceId, agent_id: mailer!.id, input: "Email test@example.com with subject Hi and body Hello" }).select("id").single();
  await executeRun(run2!.id);
  const { data: r2 } = await admin.from("runs").select("status").eq("id", run2!.id).single();
  const { data: s2 } = await admin.from("run_steps").select("kind, content").eq("run_id", run2!.id).eq("kind", "tool_result");
  const reported = JSON.stringify(s2 ?? []);
  check(
    "unconfigured email tool fails gracefully (run still completes)",
    r2?.status === "succeeded" && (process.env.RESEND_API_KEY ? reported.includes("sent") : reported.includes("not configured")),
    reported.slice(0, 120),
  );
} catch (err) {
  failures++;
  console.log("FAIL  unexpected error —", err instanceof Error ? err.message : err);
} finally {
  for (const id of users) await admin.auth.admin.deleteUser(id);
  console.log(`\nCleaned up ${users.length} test users. ${failures ? failures + " FAILED" : "ALL PASSED"}`);
  process.exit(failures ? 1 : 0);
}
