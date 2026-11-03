import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Current user + their (first) workspace. Redirects to /login if signed out. */
export const getContext = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role, workspaces(id, name, monthly_token_limit)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const ws = membership?.workspaces as unknown as
    | { id: string; name: string; monthly_token_limit: number }
    | null;
  if (!membership || !ws) {
    throw new Error(
      "No workspace found for this user. Did you run supabase/migrations/0001_init.sql before signing up?",
    );
  }
  return { supabase, user, workspace: ws, role: membership.role as string };
});
