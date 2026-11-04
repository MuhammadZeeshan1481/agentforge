import Link from "next/link";
import { Suspense } from "react";
import { clsx } from "clsx";
import { Card, PageHeader } from "@/components/ui";
import { PageSkeleton } from "@/components/page-skeleton";
import { AGENT_TEMPLATES, getTemplate } from "@/lib/templates";
import { AgentForm } from "../agent-form";
import { createAgent } from "../actions";

async function NewAgentContent({ searchParams }: PageProps<"/agents/new">) {
  const { template: t } = await searchParams;
  const template = getTemplate(typeof t === "string" ? t : null);
  return (
    <>
      <PageHeader title="New agent" description="Start from a template or from scratch." />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/agents/new"
          className={clsx(
            "rounded-lg border p-4 text-sm transition hover:border-indigo-400",
            !template ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30" : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900",
          )}
        >
          <p className="font-medium">Blank agent</p>
          <p className="mt-1 text-zinc-500">Start from scratch.</p>
        </Link>
        {AGENT_TEMPLATES.map((tpl) => (
          <Link
            key={tpl.id}
            href={`/agents/new?template=${tpl.id}`}
            className={clsx(
              "rounded-lg border p-4 text-sm transition hover:border-indigo-400",
              template?.id === tpl.id
                ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30"
                : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900",
            )}
          >
            <p className="font-medium">{tpl.name}</p>
            <p className="mt-1 text-zinc-500">{tpl.description}</p>
          </Link>
        ))}
      </div>
      <Card>
        {template && (
          <p className="mb-4 rounded-md bg-zinc-50 p-3 text-sm text-zinc-600 dark:bg-zinc-950 dark:text-zinc-400">
            Try it with: <span className="italic">{template.example_input}</span>
          </p>
        )}
        <AgentForm
          key={template?.id ?? "blank"}
          agent={template ? { ...template, id: undefined } : undefined}
          action={createAgent}
          submitLabel="Create agent"
        />
      </Card>
    </>
  );
}

export default function NewAgentPage(props: PageProps<"/agents/new">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NewAgentContent {...props} />
    </Suspense>
  );
}
