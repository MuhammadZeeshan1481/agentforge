// Shared (client + server) metadata about the built-in tools.
export const TOOL_CATALOG = {
  web_fetch: {
    label: "Web fetch",
    description: "Fetch a public web page and return its readable text content.",
  },
  http_request: {
    label: "HTTP request (custom API)",
    description:
      "Call any public HTTP API with a method, headers and body. Returns status and response body.",
  },
  slack_post: {
    label: "Post to Slack",
    description: "Post a message to the Slack channel configured for this agent.",
    configField: { key: "webhook_url", label: "Slack incoming webhook URL" },
  },
  current_time: {
    label: "Current time",
    description: "Get the current date and time, optionally in a given IANA timezone.",
  },
} as const;

export type ToolId = keyof typeof TOOL_CATALOG;
export const TOOL_IDS = Object.keys(TOOL_CATALOG) as ToolId[];

export const MODELS = [
  { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite (fast, cheapest)" },
  { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash (smarter)" },
] as const;
export const DEFAULT_MODEL = MODELS[0].id;
