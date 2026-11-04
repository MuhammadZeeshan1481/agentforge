"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getContext } from "@/lib/workspace";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createPlainClient } from "@supabase/supabase-js";

export type State = { error?: string; message?: string };

const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72)
  .refine((p) => /[a-zA-Z]/.test(p) && /\d/.test(p), "Use at least one letter and one number");

export async function updateProfile(_: State, formData: FormData): Promise<State> {
  const { supabase, user } = await getContext();
  const name = z.string().trim().min(1, "Enter your name").max(100).safeParse(formData.get("name"));
  if (!name.success) return { error: name.error.issues[0].message };
  const { error } = await supabase.from("profiles").update({ full_name: name.data, updated_at: new Date().toISOString() }).eq("id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { message: "Profile updated" };
}

export async function changeEmail(_: State, formData: FormData): Promise<State> {
  const { supabase } = await getContext();
  const email = z.string().trim().toLowerCase().email("Enter a valid email").safeParse(formData.get("email"));
  if (!email.success) return { error: email.error.issues[0].message };
  const h = await headers();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const { error } = await supabase.auth.updateUser({ email: email.data }, { emailRedirectTo: `${origin}/auth/callback?next=/account` });
  if (error) return { error: error.message };
  return { message: `Check ${email.data} (and your current inbox) to confirm the change.` };
}

export async function changePassword(_: State, formData: FormData): Promise<State> {
  const { supabase, user } = await getContext();
  const parsed = z
    .object({ current: z.string().min(1, "Enter your current password"), password, confirm: z.string() })
    .refine((d) => d.password === d.confirm, { message: "New passwords don't match" })
    .safeParse({ current: formData.get("current"), password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Verify the current password with a throwaway client (doesn't touch the session cookies).
  const verifier = createPlainClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { error: wrong } = await verifier.auth.signInWithPassword({ email: user.email!, password: parsed.data.current });
  if (wrong) return { error: "Current password is incorrect" };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: error.message };
  return { message: "Password changed" };
}

export async function deleteAccount(_: State, formData: FormData): Promise<State> {
  const { supabase, user } = await getContext();
  if (formData.get("confirm") !== "DELETE") return { error: 'Type DELETE to confirm' };
  // Workspaces you own (and everything in them) are deleted with your account.
  const { error } = await createAdminClient().auth.admin.deleteUser(user.id);
  if (error) return { error: error.message };
  await supabase.auth.signOut();
  redirect("/?deleted=1");
}
