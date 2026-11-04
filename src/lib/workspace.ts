import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const WORKSPACE_COOKIE = "af_ws";

type Workspace = { id: string; name: string; monthly_token_limit: number; owner_id: string };
type Membership = { role: string; workspaces: Workspace };

/**
 * Current user + selected workspace (cookie `af_ws`, falling back to the first
 * one the user joined). Redirects to /login if signed out.
 */
export const getContext = cache(async () => {
  // Per-request data: opt out of prerendering before touching auth/time.
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("workspace_members")
    .select("role, workspaces(id, name, monthly_token_limit, owner_id)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const memberships = ((data ?? []) as unknown as Membership[]).filter((m) => m.workspaces);
  if (!memberships.length) {
    throw new Error(
      "No workspace found for this user. Did you run supabase/migrations/0001_init.sql before signing up?",
    );
  }
  const selected = (await cookies()).get(WORKSPACE_COOKIE)?.value;
  const current = memberships.find((m) => m.workspaces.id === selected) ?? memberships[0];

  return {
    supabase,
    user,
    workspace: current.workspaces,
    role: current.role,
    canEdit: ["owner", "admin", "editor"].includes(current.role),
    isAdmin: ["owner", "admin"].includes(current.role),
    workspaces: memberships.map((m) => ({ id: m.workspaces.id, name: m.workspaces.name, role: m.role })),
  };
});
