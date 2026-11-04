import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { LIMITS, rateLimit } from "@/lib/rate-limit";

export const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");

export function generateApiKey() {
  const key = `af_${randomBytes(24).toString("base64url")}`;
  return { key, prefix: key.slice(0, 10), hash: hashKey(key) };
}

/** Resolves `Authorization: Bearer af_…` to a workspace id, or null. */
export async function authenticateApiKey(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const key = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!key.startsWith("af_")) return null;
  const db = createAdminClient();
  const { data } = await db
    .from("api_keys")
    .select("id, workspace_id, revoked_at")
    .eq("key_hash", hashKey(key))
    .maybeSingle();
  if (!data || data.revoked_at) return null;
  await db.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  const allowed = await rateLimit(`api:${data.id}`, LIMITS.apiPerKey);
  return { workspaceId: data.workspace_id as string, db, keyId: data.id as string, limited: !allowed };
}

export function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export const json = (body: unknown, status = 200) => Response.json(body, { status });
