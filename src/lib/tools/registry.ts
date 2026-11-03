import "server-only";
import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { htmlToText, safeFetch } from "./safe-fetch";
import { TOOL_CATALOG, type ToolId } from "./catalog";

const MAX_TOOL_OUTPUT = 12_000;
const clip = (s: string) =>
  s.length > MAX_TOOL_OUTPUT ? s.slice(0, MAX_TOOL_OUTPUT) + "\n…[truncated]" : s;

type ToolConfig = Record<string, Record<string, string> | undefined>;

function buildTool(id: ToolId, config: ToolConfig) {
  switch (id) {
    case "web_fetch":
      return tool({
        description: TOOL_CATALOG.web_fetch.description,
        inputSchema: z.object({ url: z.string().url().describe("Absolute http(s) URL") }),
        execute: async ({ url }) => {
          const r = await safeFetch(url);
          const text = r.contentType.includes("html") ? htmlToText(r.body) : r.body;
          return { status: r.status, url: r.url, content: clip(text) };
        },
      });

    case "http_request":
      return tool({
        description: TOOL_CATALOG.http_request.description,
        inputSchema: z.object({
          url: z.string().url(),
          method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("GET"),
          headers: z.record(z.string(), z.string()).optional(),
          body: z.string().optional().describe("Raw request body, e.g. JSON string"),
        }),
        execute: async ({ url, method, headers, body }) => {
          const r = await safeFetch(url, { method, headers, body });
          return { status: r.status, contentType: r.contentType, body: clip(r.body) };
        },
      });

    case "slack_post":
      return tool({
        description: TOOL_CATALOG.slack_post.description,
        inputSchema: z.object({ text: z.string().min(1).max(4000) }),
        execute: async ({ text }) => {
          const webhook = config.slack_post?.webhook_url;
          if (!webhook || !/^https:\/\/hooks\.slack\.com\//.test(webhook)) {
            return { ok: false, error: "Slack webhook URL is not configured for this agent" };
          }
          const res = await fetch(webhook, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ text }),
            signal: AbortSignal.timeout(10_000),
          });
          return { ok: res.ok, status: res.status };
        },
      });

    case "current_time":
      return tool({
        description: TOOL_CATALOG.current_time.description,
        inputSchema: z.object({
          timezone: z.string().optional().describe("IANA timezone, e.g. Asia/Karachi"),
        }),
        execute: async ({ timezone }) => {
          const tz = timezone || "UTC";
          try {
            return {
              iso: new Date().toISOString(),
              local: new Date().toLocaleString("en-US", { timeZone: tz }),
              timezone: tz,
            };
          } catch {
            return { iso: new Date().toISOString(), error: `Unknown timezone ${tz}` };
          }
        },
      });
  }
}

export function buildToolSet(ids: string[], config: ToolConfig): ToolSet {
  const set: ToolSet = {};
  for (const id of ids) {
    if (id in TOOL_CATALOG) set[id] = buildTool(id as ToolId, config);
  }
  return set;
}
