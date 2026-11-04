// Ready-made agent templates (used on /agents/new?template=<id>).
export type AgentTemplate = {
  id: string;
  name: string;
  description: string;
  instructions: string;
  tools: string[];
  max_steps: number;
  example_input: string;
};

export const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    id: "web-researcher",
    name: "Web Researcher",
    description: "Reads web pages and writes a sourced summary.",
    instructions:
      "You are a careful research assistant. Use web_fetch to read every URL the user gives you (and follow up to 2 relevant links if needed). Write a concise summary with bullet points, then list the sources you used. Never invent facts that are not in the pages.",
    tools: ["web_fetch"],
    max_steps: 8,
    example_input: "Summarize the key points of https://en.wikipedia.org/wiki/Large_language_model",
  },
  {
    id: "support-agent",
    name: "Customer Support Agent",
    description: "Answers customer questions from your knowledge base.",
    instructions:
      "You are a friendly customer support agent. Always search the knowledge base with search_knowledge before answering. Answer only from what you find; if the answer isn't there, say you'll escalate to a human. Keep replies short and polite.",
    tools: ["search_knowledge"],
    max_steps: 5,
    example_input: "How do I reset my password?",
  },
  {
    id: "lead-qualifier",
    name: "Lead Qualifier",
    description: "Scores an inbound lead and explains why.",
    instructions:
      "You qualify B2B sales leads. Given a lead's details (and optionally their company website, which you can read with web_fetch), score them HOT, WARM or COLD using: company size, clear need, budget signals, and timeline. Reply with the score on the first line, then 3 short bullet reasons, then a suggested next action.",
    tools: ["web_fetch"],
    max_steps: 5,
    example_input: "Name: Sara Khan, Company: Acme Logistics (acme.example.com), 200 employees, wants to automate invoice processing this quarter.",
  },
  {
    id: "content-writer",
    name: "Content Writer",
    description: "Drafts blog posts and social copy in your voice.",
    instructions:
      "You are a content writer. Write clear, engaging content with a strong headline, short paragraphs and a call to action. Use save_memory to remember the user's brand voice, audience and style preferences when they tell you, and follow remembered preferences.",
    tools: ["memory"],
    max_steps: 4,
    example_input: "Write a LinkedIn post announcing our new AI agent platform. Our tone is confident but friendly.",
  },
  {
    id: "api-monitor",
    name: "API Health Checker",
    description: "Calls an HTTP endpoint and reports problems to Slack.",
    instructions:
      "You check API health. Call the URL the user gives with http_request. If the status is not 2xx or the response looks wrong, post a short alert to Slack with slack_post describing the problem. Always finish with a one-line status report.",
    tools: ["http_request", "slack_post", "current_time"],
    max_steps: 5,
    example_input: "Check https://api.github.com/status",
  },
];

export const getTemplate = (id?: string | null) => AGENT_TEMPLATES.find((t) => t.id === id);
