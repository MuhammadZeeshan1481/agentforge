import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { appOrigin } from "@/lib/origin";
import { safeEqual } from "@/lib/api-auth";
import { completeOAuth } from "@/lib/integrations/oauth";
import { PROVIDERS, type ProviderId } from "@/lib/integrations/providers";

export async function GET(request: NextRequest, ctx: RouteContext<"/api/integrations/callback/[provider]">) {
  const { provider } = await ctx.params;
  const origin = await appOrigin();
  const back = (q: string) => {
    const res = NextResponse.redirect(`${origin}/integrations?${q}`);
    res.cookies.delete({ name: `af_oauth_${provider}`, path: "/api/integrations" });
    return res;
  };
  if (!(provider in PROVIDERS)) return back("error=unknown_provider");

  const sp = request.nextUrl.searchParams;
  if (sp.get("error")) return back(`error=${encodeURIComponent(sp.get("error_description") ?? sp.get("error")!)}`);
  const code = sp.get("code");
  const state = sp.get("state") ?? "";
  const [expected, workspaceId] = (request.cookies.get(`af_oauth_${provider}`)?.value ?? "").split(".");
  if (!code || !expected || !workspaceId || !safeEqual(state, expected)) return back("error=invalid_state");

  // The user must still be an admin of that workspace.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return back("error=signed_out");
  const { data: m } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!m || !["owner", "admin"].includes(m.role)) return back("error=not_admin");

  try {
    await completeOAuth(provider as ProviderId, code, `${origin}/api/integrations/callback/${provider}`, workspaceId, user.id);
    return back(`connected=${provider}`);
  } catch (err) {
    return back(`error=${encodeURIComponent(err instanceof Error ? err.message : "Connection failed")}`);
  }
}
