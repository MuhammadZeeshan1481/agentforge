import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Fixed-window rate limit backed by Postgres (works across serverless instances).
 * Returns true when allowed. Fails open if the limiter itself errors.
 */
export async function rateLimit(bucket: string, max: number, windowSeconds = 60) {
  const { data, error } = await createAdminClient().rpc("rate_limit_hit", {
    bucket,
    window_seconds: windowSeconds,
    max_hits: max,
  });
  if (error) return true;
  return data === true;
}

export const LIMITS = {
  webhookPerWorkflow: 60, // per minute
  apiPerKey: 120,
  runsPerUser: 30,
  docsPerUser: 20,
} as const;

export function tooMany(message = "Too many requests — slow down and try again in a minute.") {
  return Response.json({ error: message }, { status: 429, headers: { "retry-after": "60" } });
}
