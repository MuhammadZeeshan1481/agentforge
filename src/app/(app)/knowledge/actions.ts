"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getContext } from "@/lib/workspace";
import { createAdminClient } from "@/lib/supabase/admin";
import { chunkText } from "@/lib/knowledge";
import { embedDocuments, toVector } from "@/lib/embeddings";
import { LIMITS, rateLimit } from "@/lib/rate-limit";

export type FormState = { error?: string; ok?: boolean; message?: string };

const MAX_FILE = 4 * 1024 * 1024;
const TEXT_EXT = /\.(txt|md|markdown|csv|json|html?|xml|ya?ml|log)$/i;

async function extract(file: File): Promise<{ text: string; source: "pdf" | "file" }> {
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
    const { text } = await extractText(pdf, { mergePages: true });
    return { text: String(text), source: "pdf" };
  }
  if (file.type.startsWith("text/") || file.type === "application/json" || TEXT_EXT.test(file.name)) {
    return { text: await file.text(), source: "file" };
  }
  throw new Error("Unsupported file type. Upload a PDF or a text file (.txt, .md, .csv, .json, .html).");
}

/** Chunk, embed and store a document's text. Marks the doc failed on error. */
async function indexDocument(docId: string, workspaceId: string, text: string) {
  const db = createAdminClient();
  const chunks = chunkText(text);
  await db.from("knowledge_chunks").delete().eq("doc_id", docId);
  let embeddings: number[][] | null = null;
  let warn: string | null = null;
  try {
    embeddings = await embedDocuments(chunks);
  } catch (e) {
    warn = `Semantic index unavailable (${e instanceof Error ? e.message : "embedding failed"}); keyword search still works.`;
  }
  for (let i = 0; i < chunks.length; i += 100) {
    const { error } = await db.from("knowledge_chunks").insert(
      chunks.slice(i, i + 100).map((content, j) => ({
        doc_id: docId,
        workspace_id: workspaceId,
        chunk_index: i + j,
        content,
        embedding: embeddings ? toVector(embeddings[i + j]) : null,
      })),
    );
    if (error) throw new Error(error.message);
  }
  await db.from("knowledge_docs").update({ status: "ready", error: warn }).eq("id", docId);
  return { chunks: chunks.length, semantic: !!embeddings };
}

export async function addDocument(_: FormState, formData: FormData): Promise<FormState> {
  const { user, workspace, canEdit } = await getContext();
  if (!canEdit) return { error: "You don't have permission to add documents." };
  if (!(await rateLimit(`docs:${user.id}`, LIMITS.docsPerUser))) return { error: "Too many uploads — wait a minute." };

  const file = formData.get("file");
  let title = String(formData.get("title") ?? "").trim();
  let content = String(formData.get("content") ?? "");
  let source: "text" | "file" | "pdf" = "text";
  let fileName: string | null = null;

  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_FILE) return { error: "File is too large (4 MB max)." };
    try {
      const r = await extract(file);
      content = r.text;
      source = r.source;
      fileName = file.name;
      if (!title) title = file.name.replace(/\.[^.]+$/, "");
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Could not read the file." };
    }
  }

  const parsed = z
    .object({
      title: z.string().trim().min(1, "Give the document a title").max(200),
      content: z.string().trim().min(1, source === "pdf" ? "No text found in this PDF (scanned PDFs need OCR)." : "Add some content or upload a file").max(500000, "Document is too large (500k characters max)"),
    })
    .safeParse({ title, content });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const db = createAdminClient();
  const { data: doc, error } = await db
    .from("knowledge_docs")
    .insert({ ...parsed.data, workspace_id: workspace.id, created_by: user.id, source, file_name: fileName, status: "processing" })
    .select("id")
    .single();
  if (error) return { error: error.message };

  try {
    const r = await indexDocument(doc.id, workspace.id, parsed.data.content);
    revalidatePath("/knowledge");
    return { ok: true, message: `Indexed ${r.chunks} chunk${r.chunks === 1 ? "" : "s"}${r.semantic ? " with semantic search" : " (keyword only)"}.` };
  } catch (e) {
    await db.from("knowledge_docs").update({ status: "failed", error: e instanceof Error ? e.message : "Indexing failed" }).eq("id", doc.id);
    revalidatePath("/knowledge");
    return { error: "Indexing failed. Try again." };
  }
}

export async function reindexDocument(id: string) {
  const { supabase, workspace, canEdit } = await getContext();
  if (!canEdit) return;
  const { data: doc } = await supabase.from("knowledge_docs").select("id, content").eq("id", id).eq("workspace_id", workspace.id).maybeSingle();
  if (!doc) return;
  await createAdminClient().from("knowledge_docs").update({ status: "processing" }).eq("id", id);
  await indexDocument(doc.id, workspace.id, doc.content).catch(() => {});
  revalidatePath("/knowledge");
}

export async function deleteDocument(id: string) {
  const { supabase } = await getContext();
  await supabase.from("knowledge_docs").delete().eq("id", id);
  revalidatePath("/knowledge");
}

/** Try a search from the UI (same retrieval the agent tool uses). */
export async function testSearch(query: string) {
  const { workspace } = await getContext();
  const q = query.trim().slice(0, 300);
  if (!q) return [];
  const db = createAdminClient();
  try {
    const { embedQuery } = await import("@/lib/embeddings");
    const e = await embedQuery(q);
    const { data, error } = await db.rpc("search_knowledge_hybrid", { ws: workspace.id, query: q, query_embedding: toVector(e), match_count: 5 });
    if (!error) return (data ?? []) as { title: string; content: string; score: number }[];
  } catch {}
  const { data } = await db.rpc("search_knowledge", { ws: workspace.id, query: q, match_count: 5 });
  return ((data ?? []) as { title: string; content: string; rank: number }[]).map((r) => ({ ...r, score: r.rank }));
}
