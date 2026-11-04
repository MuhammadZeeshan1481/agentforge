"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; message?: string; email?: string; needsConfirmation?: boolean };

const email = z.string().trim().toLowerCase().email("Enter a valid email address");
const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters")
  .refine((p) => /[a-zA-Z]/.test(p) && /\d/.test(p), "Use at least one letter and one number");

async function siteOrigin() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  return h.get("origin") ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
}

function safeNext(next: FormDataEntryValue | null) {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/dashboard";
}

/** Map Supabase auth errors to friendlier copy. */
function friendly(message: string) {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Incorrect email or password.";
  if (m.includes("email not confirmed")) return "Please confirm your email first — check your inbox.";
  if (m.includes("user already registered")) return "An account with this email already exists. Try signing in.";
  if (m.includes("rate limit") || m.includes("too many")) return "Too many attempts. Please wait a minute and try again.";
  if (m.includes("provider is not enabled")) return "This sign-in method isn't enabled yet.";
  return message;
}

export async function signIn(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = z.object({ email, password: z.string().min(1, "Enter your password") }).safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message, email: String(formData.get("email") ?? "") };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return {
      error: friendly(error.message),
      email: parsed.data.email,
      needsConfirmation: error.message.toLowerCase().includes("not confirmed"),
    };
  }
  redirect(safeNext(formData.get("next")));
}

export async function signUp(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = z
    .object({ name: z.string().trim().min(1, "Enter your name").max(100), email, password })
    .safeParse({ name: formData.get("name"), email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message, email: String(formData.get("email") ?? "") };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.name },
      emailRedirectTo: `${await siteOrigin()}/auth/callback?next=/onboarding`,
    },
  });
  if (error) return { error: friendly(error.message), email: parsed.data.email };
  // Supabase returns a user with no identities when the email is already registered.
  if (data.user && data.user.identities?.length === 0) {
    return { error: "An account with this email already exists. Try signing in.", email: parsed.data.email };
  }
  if (data.session) redirect("/onboarding");
  return { message: "sent", email: parsed.data.email, needsConfirmation: true };
}

export async function sendMagicLink(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = email.safeParse(formData.get("email"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${await siteOrigin()}/auth/callback?next=${encodeURIComponent(safeNext(formData.get("next")))}`,
    },
  });
  // Don't reveal whether the account exists.
  if (error && !error.message.toLowerCase().includes("signups not allowed")) return { error: friendly(error.message) };
  return { message: "sent", email: parsed.data };
}

export async function resendConfirmation(emailAddress: string): Promise<AuthState> {
  const parsed = email.safeParse(emailAddress);
  if (!parsed.success) return { error: "Enter a valid email address" };
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data,
    options: { emailRedirectTo: `${await siteOrigin()}/auth/callback?next=/onboarding` },
  });
  if (error) return { error: friendly(error.message) };
  return { message: "Confirmation email sent again." };
}

export async function signInWithGoogle(formData: FormData) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await siteOrigin()}/auth/callback?next=${encodeURIComponent(safeNext(formData.get("next")))}` },
  });
  if (error || !data.url) redirect(`/login?error=${encodeURIComponent(friendly(error?.message ?? "Google sign-in failed"))}`);
  redirect(data.url);
}

export async function requestPasswordReset(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = email.safeParse(formData.get("email"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${await siteOrigin()}/auth/callback?next=/reset-password`,
  });
  if (error && error.message.toLowerCase().includes("rate")) return { error: friendly(error.message) };
  return { message: "sent", email: parsed.data };
}

export async function updatePassword(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = z
    .object({ password, confirm: z.string() })
    .refine((d) => d.password === d.confirm, { message: "Passwords don't match", path: ["confirm"] })
    .safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Your reset link has expired. Request a new one." };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: friendly(error.message) };
  redirect("/dashboard?toast=password-updated");
}
