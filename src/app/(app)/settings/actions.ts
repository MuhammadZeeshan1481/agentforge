"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getContext, WORKSPACE_COOKIE } from "@/lib/workspace";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateApiKey } from "@/lib/api-auth";
import { emailEnabled, emailLayout, escapeHtml, sendEmail } from "@/lib/email";
import { appOrigin } from "@/lib/origin";

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
  (await cookies()).set(WORKSPACE_COOKIE, workspaceId, { path: "/", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 365 });
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

export async function createInvite(_: FormState & { message?: string }, formData: FormData): Promise<FormState & { message?: string }> {
  const { workspace, user, isAdmin, profile } = await getContext();
  if (!isAdmin) return { error: "Only admins can invite people." };
  const role = z.enum(["admin", "editor", "viewer"]).catch("editor").parse(formData.get("role"));
  const emailRaw = String(formData.get("email") ?? "").trim().toLowerCase();
  const email = emailRaw ? z.string().email().safeParse(emailRaw) : null;
  if (email && !email.success) return { error: "Enter a valid email address" };

  const db = createAdminClient();
  const { data: invite, error } = await db
    .from("workspace_invites")
    .insert({ workspace_id: workspace.id, role, created_by: user.id, email: email?.data ?? null })
    .select("id, token")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/settings");

  if (!email) return { ok: true, message: "Invite link created" };
  if (!emailEnabled()) return { ok: true, message: "Invite link created — email isn't configured, so share the link yourself." };
  const url = `${await appOrigin()}/invite/${invite.token}`;
  const sent = await sendEmail({
    to: email.data,
    subject: `${profile.fullName} invited you to ${workspace.name} on AgentForge`,
    html: emailLayout({
      title: `Join ${escapeHtml(workspace.name)} on AgentForge`,
      body: `${escapeHtml(profile.fullName)} invited you to collaborate as <b>${role}</b>. The invite expires in 7 days.`,
      cta: { label: "Accept invite", url },
    }),
  });
  if (!sent.ok) return { ok: true, message: `Invite created, but the email failed: ${sent.error}` };
  await db.from("workspace_invites").update({ email_sent_at: new Date().toISOString() }).eq("id", invite.id);
  return { ok: true, message: `Invite sent to ${email.data}` };
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
