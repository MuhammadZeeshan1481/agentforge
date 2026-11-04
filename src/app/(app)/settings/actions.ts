"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getContext, WORKSPACE_COOKIE } from "@/lib/workspace";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateApiKey } from "@/lib/api-auth";

export type KeyState = { error?: string; key?: string };
export type FormState = { error?: string; ok?: boolean };

export async function renameWorkspace(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, workspace, user } = await getContext();
  if (workspace.owner_id !== user.id) return { error: "Only the owner can rename the workspace." };
  const name = z.string().trim().min(1).max(100).safeParse(formData.get("name"));
  if (!name.success) return { error: "Enter a name (1–100 characters)." };
  const { error } = await supabase.from("workspaces").update({ name: name.data }).eq("id", workspace.id);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function switchWorkspace(workspaceId: string) {
  const { workspaces } = await getContext();
  if (!workspaces.some((w) => w.id === workspaceId)) return;
  (await cookies()).set(WORKSPACE_COOKIE, workspaceId, { path: "/", httpOnly: true, sameSite: "lax", secure: true, maxAge: 60 * 60 * 24 * 365 });
  redirect("/dashboard");
}

export async function createApiKey(_: KeyState, formData: FormData): Promise<KeyState> {
  const { workspace, user, isAdmin } = await getContext();
  if (!isAdmin) return { error: "Only admins can create API keys." };
  const name = z.string().trim().min(1).max(100).safeParse(formData.get("name"));
  if (!name.success) return { error: "Give the key a name." };
  const { key, prefix, hash } = generateApiKey();
  const { error } = await createAdminClient()
    .from("api_keys")
    .insert({ workspace_id: workspace.id, name: name.data, prefix, key_hash: hash, created_by: user.id });
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { key };
}

export async function revokeApiKey(id: string) {
  const { workspace, isAdmin } = await getContext();
  if (!isAdmin) return;
  await createAdminClient()
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("workspace_id", workspace.id);
  revalidatePath("/settings");
}

export async function createInvite(formData: FormData) {
  const { workspace, user, isAdmin } = await getContext();
  if (!isAdmin) return;
  const role = z.enum(["admin", "editor", "viewer"]).catch("editor").parse(formData.get("role"));
  await createAdminClient()
    .from("workspace_invites")
    .insert({ workspace_id: workspace.id, role, created_by: user.id });
  revalidatePath("/settings");
}

export async function deleteInvite(id: string) {
  const { workspace, isAdmin } = await getContext();
  if (!isAdmin) return;
  await createAdminClient().from("workspace_invites").delete().eq("id", id).eq("workspace_id", workspace.id);
  revalidatePath("/settings");
}

export async function removeMember(userId: string) {
  const { supabase, workspace, isAdmin, user } = await getContext();
  if (!isAdmin || userId === user.id) return;
  await supabase.from("workspace_members").delete().eq("workspace_id", workspace.id).eq("user_id", userId);
  revalidatePath("/settings");
}
