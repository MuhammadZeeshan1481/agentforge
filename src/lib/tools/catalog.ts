// Shared (client + server) metadata about the built-in tools.
export type ToolMeta = {
  label: string;
  description: string;
  category: "Web" | "Knowledge" | "Communication" | "Google" | "Notion" | "Utility";
  provider?: "google" | "notion";
  configField?: { key: string; label: string };
};

export const TOOL_CATALOG = {
  web_fetch: { label: "Web fetch", category: "Web", description: "Fetch a public web page and return its readable text content." },
  http_request: { label: "HTTP request", category: "Web", description: "Call any public HTTP API with a method, headers and body. Returns status and response body." },
  search_knowledge: { label: "Knowledge base", category: "Knowledge", description: "Semantic + keyword search over this workspace's documents (including PDFs)." },
  memory: { label: "Long-term memory", category: "Knowledge", description: "Lets the agent save facts with save_memory. Saved memories are included in every future run of this agent." },
  send_email: { label: "Send email", category: "Communication", description: "Send an email from AgentForge (via Resend) to any address." },
  slack_post: { label: "Post to Slack", category: "Communication", description: "Post a message to the Slack channel configured for this agent.", configField: { key: "webhook_url", label: "Slack incoming webhook URL" } },
  gmail_send: { label: "Gmail · send", category: "Google", provider: "google", description: "Send an email from the connected Gmail account." },
  gmail_search: { label: "Gmail · search", category: "Google", provider: "google", description: "Search the connected Gmail inbox and read message snippets." },
  sheets_read: { label: "Sheets · read", category: "Google", provider: "google", description: "Read a range of cells from a Google Sheet." },
  sheets_append: { label: "Sheets · append", category: "Google", provider: "google", description: "Append rows to a Google Sheet." },
  notion_search: { label: "Notion · search", category: "Notion", provider: "notion", description: "Search pages in the connected Notion workspace." },
  notion_create_page: { label: "Notion · create page", category: "Notion", provider: "notion", description: "Create a new Notion page with text content." },
  current_time: { label: "Current time", category: "Utility", description: "Get the current date and time, optionally in a given IANA timezone." },
} as const satisfies Record<string, ToolMeta>;

export type ToolId = keyof typeof TOOL_CATALOG;
export const TOOL_IDS = Object.keys(TOOL_CATALOG) as ToolId[];
export const TOOL_CATEGORIES = ["Web", "Knowledge", "Communication", "Google", "Notion", "Utility"] as const;

export const MODELS = [
  { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite", hint: "Fastest · cheapest" },
  { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash", hint: "Smarter · balanced" },
  { id: "gemini-pro-latest", label: "Gemini Pro", hint: "Most capable · paid tier recommended" },
] as const;
export const DEFAULT_MODEL = MODELS[0].id;
