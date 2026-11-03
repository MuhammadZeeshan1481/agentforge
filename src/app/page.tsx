import { LinkButton } from "@/components/ui";

const features = [
  ["Agent builder", "Give an agent a role, instructions, a model and tools."],
  ["Tool calling", "Web fetch, any HTTP API, Slack and more — with SSRF protection."],
  ["Live run logs", "Every model step and tool call streams in as it happens."],
  ["Usage control", "Token usage per run and a monthly budget per workspace."],
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center px-6 py-16">
      <p className="text-sm font-medium text-indigo-600">AgentForge</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
        Build AI agents that actually do the work.
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-zinc-500">
        Create agents with tools, run them in the background, and watch every step live.
      </p>
      <div className="mt-8 flex gap-3">
        <LinkButton href="/login">Get started</LinkButton>
        <LinkButton href="/dashboard" variant="secondary">
          Dashboard
        </LinkButton>
      </div>
      <div className="mt-16 grid gap-4 sm:grid-cols-2">
        {features.map(([t, d]) => (
          <div key={t} className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
            <p className="font-medium">{t}</p>
            <p className="mt-1 text-sm text-zinc-500">{d}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
