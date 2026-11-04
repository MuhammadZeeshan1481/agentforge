import "server-only";
import { tool } from "ai";
import { z } from "zod";
import { getAccessToken } from "./oauth";

const clip = (s: string, n = 8000) => (s.length > n ? s.slice(0, n) + "…[truncated]" : s);

async function gfetch(workspaceId: string, url: string, init: RequestInit = {}) {
  const token = await getAccessToken(workspaceId, "google");
  const res = await fetch(url, {
    ...init,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(20_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error?.message ?? `Google API error ${res.status}`);
  return body;
}

async function nfetch(workspaceId: string, path: string, body?: unknown) {
  const token = await getAccessToken(workspaceId, "notion");
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    method: body ? "POST" : "GET",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", "notion-version": "2022-06-28" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message ?? `Notion API error ${res.status}`);
  return json;
}

const b64url = (s: string) => Buffer.from(s, "utf8").toString("base64url");
const header = (h: { name: string; value: string }[] | undefined, n: string) => h?.find((x) => x.name.toLowerCase() === n)?.value ?? "";

export function integrationTools(workspaceId: string) {
  return {
    gmail_send: tool({
      description: "Send an email from the connected Gmail account. Use plain text. Only send when the user's instructions clearly ask for it.",
      inputSchema: z.object({
        to: z.string().email(),
        subject: z.string().min(1).max(200),
        body: z.string().min(1).max(20000),
      }),
      execute: async ({ to, subject, body }) => {
        const raw = [`To: ${to}`, `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`, "MIME-Version: 1.0", "Content-Type: text/plain; charset=UTF-8", "", body].join("\r\n");
        const r = await gfetch(workspaceId, "https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
          method: "POST",
          body: JSON.stringify({ raw: b64url(raw) }),
        });
        return { sent: true, id: r.id };
      },
    }),
    gmail_search: tool({
      description: "Search the connected Gmail inbox (Gmail search syntax, e.g. 'from:boss is:unread newer_than:2d'). Returns sender, subject, date and a snippet.",
      inputSchema: z.object({ query: z.string().max(300), max_results: z.number().int().min(1).max(20).default(5) }),
      execute: async ({ query, max_results }) => {
        const list = await gfetch(workspaceId, `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${max_results}&q=${encodeURIComponent(query)}`);
        const msgs = await Promise.all(
          (list.messages ?? []).map((m: { id: string }) =>
            gfetch(workspaceId, `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`),
          ),
        );
        return {
          results: msgs.map((m) => ({
            id: m.id,
            from: header(m.payload?.headers, "from"),
            subject: header(m.payload?.headers, "subject"),
            date: header(m.payload?.headers, "date"),
            snippet: m.snippet,
          })),
        };
      },
    }),
    sheets_read: tool({
      description: "Read cells from a Google Sheet. range uses A1 notation, e.g. 'Sheet1!A1:D20'.",
      inputSchema: z.object({ spreadsheet_id: z.string().min(10), range: z.string().min(1).max(100) }),
      execute: async ({ spreadsheet_id, range }) => {
        const r = await gfetch(workspaceId, `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheet_id)}/values/${encodeURIComponent(range)}`);
        return { range: r.range, values: (r.values ?? []).slice(0, 200) };
      },
    }),
    sheets_append: tool({
      description: "Append rows to a Google Sheet. Each row is an array of cell values.",
      inputSchema: z.object({
        spreadsheet_id: z.string().min(10),
        range: z.string().min(1).max(100).describe("e.g. 'Sheet1!A1'"),
        rows: z.array(z.array(z.union([z.string(), z.number(), z.boolean()]))).min(1).max(100),
      }),
      execute: async ({ spreadsheet_id, range, rows }) => {
        const r = await gfetch(
          workspaceId,
          `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheet_id)}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
          { method: "POST", body: JSON.stringify({ values: rows }) },
        );
        return { updatedRange: r.updates?.updatedRange, updatedRows: r.updates?.updatedRows };
      },
    }),
    notion_search: tool({
      description: "Search pages in the connected Notion workspace by title/text.",
      inputSchema: z.object({ query: z.string().max(200) }),
      execute: async ({ query }) => {
        const r = await nfetch(workspaceId, "/search", { query, page_size: 10, filter: { property: "object", value: "page" } });
        return {
          results: (r.results ?? []).map((p: { id: string; url: string; properties?: Record<string, { type: string; title?: { plain_text: string }[] }> }) => ({
            id: p.id,
            url: p.url,
            title: Object.values(p.properties ?? {}).find((v) => v.type === "title")?.title?.map((t) => t.plain_text).join("") ?? "(untitled)",
          })),
        };
      },
    }),
    notion_create_page: tool({
      description: "Create a Notion page under a parent page (get parent ids with notion_search). Content is plain text; blank lines start new paragraphs.",
      inputSchema: z.object({ parent_page_id: z.string().min(10), title: z.string().min(1).max(200), content: z.string().max(20000).default("") }),
      execute: async ({ parent_page_id, title, content }) => {
        const children = content
          .split(/\n{2,}/)
          .filter(Boolean)
          .slice(0, 90)
          .map((para) => ({ object: "block", type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content: clip(para, 1900) } }] } }));
        const r = await nfetch(workspaceId, "/pages", {
          parent: { page_id: parent_page_id },
          properties: { title: { title: [{ text: { content: title } }] } },
          children,
        });
        return { created: true, id: r.id, url: r.url };
      },
    }),
  };
}
