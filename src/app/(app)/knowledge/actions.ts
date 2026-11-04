"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getContext } from "@/lib/workspace";
import { createAdminClient } from "@/lib/supabase/admin";
import { chunkText } from "@/lib/knowledge";

export type FormState = { error?: string; ok?: boolean };

const Doc = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  content: z.string().trim().min(1, "Content is required").max(500000, "Document is too large (500k chars max)"),
});

export async function addDocument(_: FormState, formData: FormData): Promise<FormState> {
  const { user, workspace, canEdit } = await getContext();
  if (!canEdit) return { error: "You don't have permission to add documents." };
  const parsed = Doc.safeParse({ title: formData.get("title"), content: formData.get("content") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Server does the chunking, so writes go through the service role.
  const db = createAdminClient();
  const { data: doc, error } = await db
    .from("knowledge_docs")
    .insert({ ...parsed.data, workspace_id: workspace.id, created_by: user.id })
    .select("id")
    .single();
  if (error) return { error: error.message };

  const chunks = chunkText(parsed.data.content);
  for (let i = 0; i < chunks.length; i += 200) {
    const { error: e } = await db.from("knowledge_chunks").insert(
      chunks.slice(i, i + 200).map((content, j) => ({
        doc_id: doc.id,
        workspace_id: workspace.id,
        chunk_index: i + j,
        content,
      })),
    );
    if (e) {
      await db.from("knowledge_docs").delete().eq("id", doc.id);
      return { error: e.message };
    }
  }
  revalidatePath("/knowledge");
  return { ok: true };
}

export async function deleteDocument(id: string) {
  const { supabase } = await getContext();
  await supabase.from("knowledge_docs").delete().eq("id", id);
  revalidatePath("/knowledge");
}
