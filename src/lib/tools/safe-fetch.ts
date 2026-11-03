import "server-only";
import { lookup } from "node:dns/promises";
import net from "node:net";

/**
 * SSRF guard: only http(s), no private / loopback / link-local / metadata IPs,
 * redirects re-validated hop by hop, response size and time capped.
 * Note: a DNS-rebinding race between lookup and connect is still theoretically
 * possible; for stronger isolation run tools behind an egress proxy.
 */
const MAX_BYTES = 512 * 1024;
const TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 3;

function isPrivateIPv4(ip: string) {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPrivateIP(ip: string): boolean {
  if (net.isIPv4(ip)) return isPrivateIPv4(ip);
  const v6 = ip.toLowerCase();
  if (v6 === "::" || v6 === "::1") return true;
  if (v6.startsWith("::ffff:")) return isPrivateIP(v6.slice(7));
  return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(v6);
}

async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`Invalid URL: ${raw}`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Only http and https URLs are allowed");
  }
  if (url.username || url.password) throw new Error("URLs with credentials are not allowed");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw new Error("Private hosts are not allowed");
  }
  const addrs = net.isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (addrs.length === 0 || addrs.some((a) => isPrivateIP(a.address))) {
    throw new Error("URL resolves to a private or reserved address");
  }
  return url;
}

export type SafeResponse = {
  status: number;
  url: string;
  contentType: string;
  body: string;
  truncated: boolean;
};

export async function safeFetch(
  rawUrl: string,
  init: { method?: string; headers?: Record<string, string>; body?: string } = {},
): Promise<SafeResponse> {
  let url = await assertPublicUrl(rawUrl);
  let method = init.method ?? "GET";
  let body = init.body;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetch(url, {
      method,
      headers: { "user-agent": "AgentForge/0.1", ...init.headers },
      body: method === "GET" || method === "HEAD" ? undefined : body,
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = await assertPublicUrl(new URL(res.headers.get("location")!, url).toString());
      if (res.status !== 307 && res.status !== 308) {
        method = "GET";
        body = undefined;
      }
      continue;
    }

    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    let truncated = false;
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_BYTES) {
          chunks.push(value.subarray(0, value.byteLength - (size - MAX_BYTES)));
          truncated = true;
          await reader.cancel();
          break;
        }
        chunks.push(value);
      }
    }
    return {
      status: res.status,
      url: url.toString(),
      contentType: res.headers.get("content-type") ?? "",
      body: new TextDecoder().decode(Buffer.concat(chunks)),
      truncated,
    };
  }
  throw new Error("Too many redirects");
}

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}
