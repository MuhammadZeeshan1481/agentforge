// Shared (client + server) integration metadata.
export const PROVIDERS = {
  google: {
    name: "Google",
    description: "Send and search Gmail, read and append to Google Sheets.",
    envVars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    tools: ["gmail_send", "gmail_search", "sheets_read", "sheets_append"],
  },
  notion: {
    name: "Notion",
    description: "Search your Notion workspace and create pages.",
    envVars: ["NOTION_CLIENT_ID", "NOTION_CLIENT_SECRET"],
    tools: ["notion_search", "notion_create_page"],
  },
} as const;
export type ProviderId = keyof typeof PROVIDERS;
