import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { WORKSPACE_COOKIE } from "@/lib/workspace";

/** Accept a workspace invite: /invite/<token>. Requires being signed in. */
export async function GET(request: NextRequest, ctx: RouteContext<"/invite/[token]">) {
  const { token } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const url = request.nextUrl.clone();
  if (!user) {
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(`/invite/${token}`)}`;
    return NextResponse.redirect(url);
  }

  const db = createAdminClient();
  const { data: invite } = await db.from("workspace_invites").select("*").eq("token", token).maybeSingle();
  const fail = (msg: string) => new NextResponse(msg, { status: 400, headers: { "content-type": "text/plain" } });
  if (!invite) return fail("Invite not found.");
  if (invite.accepted_at) return fail("This invite has already been used.");
  if (new Date(invite.expires_at) < new Date()) return fail("This invite has expired.");

  // Claim the invite first so it can only be used once.
  const { data: claimed } = await db
    .from("workspace_invites")
    .update({ accepted_by: user.id, accepted_at: new Date().toISOString() })
    .eq("id", invite.id)
    .is("accepted_at", null)
    .select("id")
    .maybeSingle();
  if (!claimed) return fail("This invite has already been used.");

  await db
    .from("workspace_members")
    .upsert(
      { workspace_id: invite.workspace_id, user_id: user.id, role: invite.role, email: user.email },
      { onConflict: "workspace_id,user_id", ignoreDuplicates: true },
    );

  url.pathname = "/dashboard";
  url.search = "";
  const res = NextResponse.redirect(url);
  res.cookies.set(WORKSPACE_COOKIE, invite.workspace_id, { path: "/", httpOnly: true, sameSite: "lax", secure: true, maxAge: 60 * 60 * 24 * 365 });
  return res;
}
