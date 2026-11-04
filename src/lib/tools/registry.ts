import "server-only";
import { tool, type ToolSet } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { htmlToText, safeFetch } from "./safe-fetch";
import { TOOL_CATALOG, type ToolId } from "./catalog";
import { embedQuery, toVector } from "@/lib/embeddings";
import { emailLayout, escapeHtml, sendEmail } from "@/lib/email";
import { integrationTools } from "@/lib/integrations/tools";

const MAX_TOOL_OUTPUT = 12_000;
const clip = (s: string) =>
  s.length > MAX_TOOL_OUTPUT ? s.slice(0, MAX_TOOL_OUTPUT) + "\n…[truncated]" : s;

type ToolConfig = Record<string, Record<string, string> | undefined>;

export type ToolContext = {
  db: SupabaseClient;
  workspaceId: string;
  agentId: string;
  runId: string;
};

function buildTool(id: ToolId, config: ToolConfig, ctx: ToolContext) {
  switch (id) {
    default:
      throw new Error(`Unknown tool ${id}`);
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

    case "memory":
      return tool({
        description:
          "Save an important, durable fact for future runs (user preferences, decisions, key results). Keep it short.",
        inputSchema: z.object({ fact: z.string().min(1).max(500) }),
        execute: async ({ fact }) => {
          const { count } = await ctx.db
            .from("agent_memories")
            .select("id", { count: "exact", head: true })
            .eq("agent_id", ctx.agentId);
          if ((count ?? 0) >= 200) return { saved: false, error: "Memory is full (200 items)" };
          const { error } = await ctx.db.from("agent_memories").insert({
            agent_id: ctx.agentId,
            workspace_id: ctx.workspaceId,
            content: fact,
            source_run_id: ctx.runId,
          });
          return error ? { saved: false, error: error.message } : { saved: true };
        },
      });

    case "search_knowledge":
      return tool({
        description: TOOL_CATALOG.search_knowledge.description,
        inputSchema: z.object({
          query: z.string().min(1).max(300).describe("A natural-language question or keywords"),
        }),
        execute: async ({ query }) => {
          // Hybrid (vector + keyword); fall back to keyword-only if embeddings are unavailable.
          let rows: { title: string; content: string }[] | null = null;
          try {
            const embedding = await embedQuery(query);
            const { data, error } = await ctx.db.rpc("search_knowledge_hybrid", {
              ws: ctx.workspaceId,
              query,
              query_embedding: toVector(embedding),
              match_count: 5,
            });
            if (!error) rows = data;
          } catch {
            rows = null;
          }
          if (!rows) {
            const { data, error } = await ctx.db.rpc("search_knowledge", { ws: ctx.workspaceId, query, match_count: 5 });
            if (error) return { error: error.message };
            rows = data;
          }
          if (!rows?.length) return { results: [], note: "No matching documents found." };
          return { results: rows.map((r) => ({ document: r.title, excerpt: clip(r.content) })) };
        },
      });

    case "send_email":
      return tool({
        description: "Send an email (plain text body). Only send when the instructions clearly ask for it.",
        inputSchema: z.object({
          to: z.string().email(),
          subject: z.string().min(1).max(200),
          body: z.string().min(1).max(20000),
        }),
        execute: async ({ to, subject, body }) => {
          const html = emailLayout({ title: subject, body: escapeHtml(body).replace(/\n/g, "<br/>") });
          const r = await sendEmail({ to, subject, html, text: body });
          return r.ok ? { sent: true, id: r.id } : { sent: false, error: r.error };
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

const INTEGRATION_TOOLS = new Set(["gmail_send", "gmail_search", "sheets_read", "sheets_append", "notion_search", "notion_create_page"]);

export function buildToolSet(ids: string[], config: ToolConfig, ctx: ToolContext): ToolSet {
  const set: ToolSet = {};
  const integrations = ids.some((id) => INTEGRATION_TOOLS.has(id)) ? integrationTools(ctx.workspaceId) : null;
  for (const id of ids) {
    if (!(id in TOOL_CATALOG)) continue;
    if (INTEGRATION_TOOLS.has(id)) {
      set[id] = integrations![id as keyof typeof integrations];
      continue;
    }
    // The "memory" capability is exposed to the model as a save_memory tool.
    set[id === "memory" ? "save_memory" : id] = buildTool(id as ToolId, config, ctx);
  }
  return set;
}
