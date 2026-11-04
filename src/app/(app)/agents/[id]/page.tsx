import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Bot, Brain, History, Play, Settings2 } from "lucide-react";
import { Badge, Card, CardContent, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/misc";
import { PageSkeleton } from "@/components/page-skeleton";
import { UrlToast } from "@/components/app/url-toast";
import { getContext } from "@/lib/workspace";
import { emailEnabled } from "@/lib/email";
import { getTemplate } from "@/lib/templates";
import { MODELS, TOOL_CATALOG, type ToolId } from "@/lib/tools/catalog";
import type { Agent } from "@/lib/types";
import { AgentForm } from "../agent-form";
import { deleteAgent, startRun, updateAgent } from "../actions";
import { RunForm } from "./run-form";
import { DeleteButton } from "./delete-button";
import { MemoryPanel, VersionsPanel } from "./agent-extras";
import { RUN_ROW_SELECT, RunsTable, type RunRow } from "../../runs-table";

export const metadata: Metadata = { title: "Agent" };

async function AgentPageContent({ params }: PageProps<"/agents/[id]">) {
  const { id } = await params;
  const { supabase, workspace, canEdit } = await getContext();
  const { data: agent } = await supabase.from("agents").select("*").eq("id", id).maybeSingle();
  if (!agent) notFound();

  const [{ data: memories }, { data: versions }, { data: runs }, { data: conns }] = await Promise.all([
    supabase.from("agent_memories").select("id, content, created_at").eq("agent_id", id).order("created_at", { ascending: false }).limit(100),
    supabase.from("agent_versions").select("id, version, created_at, snapshot").eq("agent_id", id).order("version", { ascending: false }).limit(20),
    supabase.from("runs").select(RUN_ROW_SELECT).eq("agent_id", id).order("created_at", { ascending: false }).limit(25),
    supabase.from("connections").select("provider").eq("workspace_id", workspace.id),
  ]);
  const all = (runs ?? []) as unknown as RunRow[];
  const done = all.filter((r) => r.status === "succeeded" || r.status === "failed");
  const ok = all.filter((r) => r.status === "succeeded").length;
  const tokens = all.reduce((n, r) => n + r.input_tokens + r.output_tokens, 0);
  const tools = agent.tools as string[];
  const example = getTemplate(
    ["web-researcher", "support-agent", "lead-qualifier", "content-writer", "api-monitor"].find((t) => getTemplate(t)?.name === agent.name),
  )?.example_input;

  return (
    <>
      <Suspense><UrlToast /></Suspense>
      <PageHeader
        icon={<Bot className="size-5" />}
        title={agent.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {agent.description || "No description"}
            <Badge variant="outline">{MODELS.find((m) => m.id === agent.model)?.label ?? agent.model}</Badge>
          </span>
        }
        back={{ href: "/agents", label: "Agents" }}
        actions={canEdit && <DeleteButton action={deleteAgent.bind(null, id)} />}
      />

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Recent runs" value={all.length} />
        <StatCard label="Success rate" value={done.length ? `${Math.round((ok / done.length) * 100)}%` : "—"} />
        <StatCard label="Tokens (recent)" value={tokens.toLocaleString()} />
        <StatCard label="Tools" value={tools.length} hint={tools.slice(0, 3).map((t) => TOOL_CATALOG[t as ToolId]?.label ?? t).join(", ")} />
      </div>

      <Tabs defaultValue="run">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="run"><Play className="size-3.5" /> Run</TabsTrigger>
          <TabsTrigger value="config"><Settings2 className="size-3.5" /> Configuration</TabsTrigger>
          <TabsTrigger value="memory"><Brain className="size-3.5" /> Memory {memories?.length ? <Badge variant="secondary" className="ml-1">{memories.length}</Badge> : null}</TabsTrigger>
          <TabsTrigger value="versions"><History className="size-3.5" /> Versions</TabsTrigger>
        </TabsList>

        <TabsContent value="run" className="space-y-8">
          {canEdit && (
            <Card>
              <CardContent>
                <p className="mb-3 text-sm font-medium">Give this agent a task</p>
                <RunForm action={startRun.bind(null, id)} placeholder={example ? `e.g. ${example}` : undefined} />
              </CardContent>
            </Card>
          )}
          <div>
            <h2 className="mb-3 text-sm font-semibold">Recent runs</h2>
            {all.length ? <RunsTable runs={all} hideAgent /> : <EmptyState icon={<Play />} title="No runs yet" description="Run the agent above to see every step it takes." />}
          </div>
        </TabsContent>

        <TabsContent value="config">
          <Card>
            <CardContent className="p-6">
              <AgentForm
                agent={agent as Agent}
                action={updateAgent.bind(null, id)}
                submitLabel="Save changes"
                connected={(conns ?? []).map((c) => c.provider)}
                emailReady={emailEnabled()}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="memory">
          <MemoryPanel agentId={id} memories={memories ?? []} enabled={tools.includes("memory")} />
        </TabsContent>

        <TabsContent value="versions">
          <VersionsPanel agentId={id} versions={(versions ?? []) as never} />
        </TabsContent>
      </Tabs>
    </>
  );
}

export default function AgentPage(props: PageProps<"/agents/[id]">) {
  return <Suspense fallback={<PageSkeleton />}><AgentPageContent {...props} /></Suspense>;
}
