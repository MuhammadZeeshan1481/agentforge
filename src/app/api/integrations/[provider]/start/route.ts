import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getContext } from "@/lib/workspace";
import { appOrigin } from "@/lib/origin";
import { authorizeUrl, providerConfigured } from "@/lib/integrations/oauth";
import { PROVIDERS, type ProviderId } from "@/lib/integrations/providers";

export async function GET(_: NextRequest, ctx: RouteContext<"/api/integrations/[provider]/start">) {
  const { provider } = await ctx.params;
  const origin = await appOrigin();
  if (!(provider in PROVIDERS)) return NextResponse.redirect(`${origin}/integrations?error=unknown_provider`);
  const p = provider as ProviderId;
  const { workspace, isAdmin } = await getContext();
  if (!isAdmin) return NextResponse.redirect(`${origin}/integrations?error=${encodeURIComponent("Only admins can connect integrations")}`);
  if (!providerConfigured(p)) return NextResponse.redirect(`${origin}/integrations?error=${encodeURIComponent(`${PROVIDERS[p].name} isn't configured on the server yet`)}`);

  const state = randomBytes(24).toString("hex");
  const res = NextResponse.redirect(authorizeUrl(p, `${origin}/api/integrations/callback/${p}`, state));
  res.cookies.set(`af_oauth_${p}`, `${state}.${workspace.id}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/integrations",
    maxAge: 600,
  });
  return res;
}
