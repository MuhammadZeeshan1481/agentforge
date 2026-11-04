import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt, encrypt } from "@/lib/crypto";
import type { ProviderId } from "./providers";

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/spreadsheets",
];

export function providerConfigured(p: ProviderId) {
  return p === "google"
    ? !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
    : !!(process.env.NOTION_CLIENT_ID && process.env.NOTION_CLIENT_SECRET);
}

export function authorizeUrl(p: ProviderId, redirectUri: string, state: string) {
  if (p === "google") {
    const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    u.search = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: GOOGLE_SCOPES.join(" "),
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      state,
    }).toString();
    return u.toString();
  }
  const u = new URL("https://api.notion.com/v1/oauth/authorize");
  u.search = new URLSearchParams({
    client_id: process.env.NOTION_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    owner: "user",
    state,
  }).toString();
  return u.toString();
}

/** Exchange the authorization code and store the encrypted tokens for the workspace. */
export async function completeOAuth(p: ProviderId, code: string, redirectUri: string, workspaceId: string, userId: string) {
  let access: string, refresh: string | null = null, expiresAt: string | null = null, label = "", scopes = "";
  if (p === "google") {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const t = await res.json();
    if (!res.ok) throw new Error(t.error_description ?? t.error ?? "Google token exchange failed");
    access = t.access_token;
    refresh = t.refresh_token ?? null;
    expiresAt = new Date(Date.now() + (t.expires_in - 60) * 1000).toISOString();
    scopes = t.scope ?? "";
    const info = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { authorization: `Bearer ${access}` } });
    label = info.ok ? ((await info.json()).email ?? "Google account") : "Google account";
  } else {
    const res = await fetch("https://api.notion.com/v1/oauth/token", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Basic ${Buffer.from(`${process.env.NOTION_CLIENT_ID}:${process.env.NOTION_CLIENT_SECRET}`).toString("base64")}`,
      },
      body: JSON.stringify({ grant_type: "authorization_code", code, redirect_uri: redirectUri }),
    });
    const t = await res.json();
    if (!res.ok) throw new Error(t.error_description ?? t.error ?? "Notion token exchange failed");
    access = t.access_token;
    label = t.workspace_name ?? "Notion workspace";
  }

  const db = createAdminClient();
  const { data: existing } = await db.from("connections").select("refresh_token_enc").eq("workspace_id", workspaceId).eq("provider", p).maybeSingle();
  const { error } = await db.from("connections").upsert(
    {
      workspace_id: workspaceId,
      provider: p,
      account_label: label,
      scopes,
      access_token_enc: encrypt(access),
      // Google only returns a refresh token on first consent; keep the old one otherwise.
      refresh_token_enc: refresh ? encrypt(refresh) : (existing?.refresh_token_enc ?? null),
      expires_at: expiresAt,
      created_by: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "workspace_id,provider" },
  );
  if (error) throw new Error(error.message);
  return label;
}

/** A valid access token for the workspace's connection, refreshing Google tokens when needed. */
export async function getAccessToken(workspaceId: string, p: ProviderId): Promise<string> {
  const db = createAdminClient();
  const { data: c } = await db.from("connections").select("*").eq("workspace_id", workspaceId).eq("provider", p).maybeSingle();
  if (!c) throw new Error(`${p === "google" ? "Google" : "Notion"} is not connected. Connect it on the Integrations page.`);
  if (p === "notion" || !c.expires_at || new Date(c.expires_at) > new Date()) return decrypt(c.access_token_enc);
  if (!c.refresh_token_enc) throw new Error("Google access expired. Reconnect Google on the Integrations page.");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: decrypt(c.refresh_token_enc),
      grant_type: "refresh_token",
    }),
  });
  const t = await res.json();
  if (!res.ok) throw new Error(`Google token refresh failed: ${t.error_description ?? t.error}. Reconnect Google.`);
  await db
    .from("connections")
    .update({
      access_token_enc: encrypt(t.access_token),
      expires_at: new Date(Date.now() + (t.expires_in - 60) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", c.id);
  return t.access_token;
}
