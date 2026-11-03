import Link from "next/link";
import { Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { getContext } from "@/lib/workspace";
import { TOOL_CATALOG, type ToolId } from "@/lib/tools/catalog";

export default async function AgentsPage() {
  const { supabase, workspace } = await getContext();
  const { data: agents } = await supabase
    .from("agents")
    .select("id, name, description, model, tools, updated_at")
    .eq("workspace_id", workspace.id)
    .order("updated_at", { ascending: false });

  return (
    <>
      <PageHeader
        title="Agents"
        description="Each agent has instructions, a model and a set of tools."
        actions={<LinkButton href="/agents/new">New agent</LinkButton>}
      />
      {!agents?.length ? (
        <EmptyState title="No agents yet">
          <LinkButton href="/agents/new" className="mt-3">
            Create your first agent
          </LinkButton>
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {agents.map((a) => (
            <Link key={a.id} href={`/agents/${a.id}`}>
              <Card className="h-full transition hover:border-indigo-400">
                <p className="font-medium">{a.name}</p>
                <p className="mt-1 line-clamp-2 text-sm text-zinc-500">
                  {a.description || "No description"}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(a.tools as string[]).map((t) => (
                    <span
                      key={t}
                      className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                    >
                      {TOOL_CATALOG[t as ToolId]?.label ?? t}
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-xs text-zinc-400">{a.model}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
