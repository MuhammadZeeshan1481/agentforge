import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Bot, Plus } from "lucide-react";
import { Badge, Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { PageSkeleton } from "@/components/page-skeleton";
import { LocalTime } from "@/components/local-time";
import { getContext } from "@/lib/workspace";
import { MODELS, TOOL_CATALOG, type ToolId } from "@/lib/tools/catalog";

export const metadata: Metadata = { title: "Agents" };

async function AgentsContent() {
  const { supabase, workspace, canEdit } = await getContext();
  const [{ data: agents }, { data: stats }] = await Promise.all([
    supabase.from("agents").select("id, name, description, model, tools, updated_at").eq("workspace_id", workspace.id).order("updated_at", { ascending: false }),
    supabase.from("runs").select("agent_id, status").eq("workspace_id", workspace.id).order("created_at", { ascending: false }).limit(2000),
  ]);
  const runCount = new Map<string, { total: number; ok: number }>();
  for (const r of stats ?? []) {
    const s = runCount.get(r.agent_id) ?? { total: 0, ok: 0 };
    s.total++;
    if (r.status === "succeeded") s.ok++;
    runCount.set(r.agent_id, s);
  }
  const modelLabel = (id: string) => MODELS.find((m) => m.id === id)?.label ?? id;

  return (
    <>
      <PageHeader
        title="Agents"
        description="AI workers with instructions, a model and tools."
        actions={canEdit && <Button asChild><Link href="/agents/new"><Plus /> New agent</Link></Button>}
      />
      {!agents?.length ? (
        <EmptyState
          icon={<Bot />}
          title="No agents yet"
          description="Start from a template like Web Researcher or Support Agent, or build one from scratch."
          action={canEdit && <Button asChild><Link href="/agents/new"><Plus /> Create your first agent</Link></Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {agents.map((a) => {
            const s = runCount.get(a.id);
            return (
              <Link key={a.id} href={`/agents/${a.id}`} className="group">
                <Card className="flex h-full flex-col p-5 transition group-hover:-translate-y-0.5 group-hover:border-primary/40 group-hover:shadow-md">
                  <div className="flex items-start gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Bot className="size-5" /></span>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{a.name}</p>
                      <p className="text-xs text-muted-foreground">{modelLabel(a.model)}</p>
                    </div>
                  </div>
                  <p className="mt-3 line-clamp-2 flex-1 text-sm text-muted-foreground">{a.description || "No description"}</p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {(a.tools as string[]).slice(0, 4).map((t) => (
                      <Badge key={t} variant="secondary">{TOOL_CATALOG[t as ToolId]?.label ?? t}</Badge>
                    ))}
                    {(a.tools as string[]).length > 4 && <Badge variant="outline">+{(a.tools as string[]).length - 4}</Badge>}
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                    <span>{s ? `${s.total} runs · ${Math.round((s.ok / s.total) * 100)}% success` : "Never run"}</span>
                    <span>Updated <LocalTime iso={a.updated_at} format="short" /></span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

export default function AgentsPage() {
  return <Suspense fallback={<PageSkeleton />}><AgentsContent /></Suspense>;
}
