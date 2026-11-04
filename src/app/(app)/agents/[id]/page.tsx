import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";
import { notFound } from "next/navigation";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { getContext } from "@/lib/workspace";
import type { Agent } from "@/lib/types";
import { AgentForm } from "../agent-form";
import { deleteAgent, startRun, updateAgent } from "../actions";
import { RunForm } from "./run-form";
import { DeleteButton } from "./delete-button";
import { RUN_ROW_SELECT, RunsTable, type RunRow } from "../../runs-table";

async function AgentPageContent({ params }: PageProps<"/agents/[id]">) {
  const { id } = await params;
  const { supabase } = await getContext();
  const { data: agent } = await supabase.from("agents").select("*").eq("id", id).maybeSingle();
  if (!agent) notFound();

  const { data: runs } = await supabase
    .from("runs")
    .select(RUN_ROW_SELECT)
    .eq("agent_id", id)
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <>
      <PageHeader
        title={agent.name}
        description={agent.description || undefined}
        actions={<DeleteButton action={deleteAgent.bind(null, id)} />}
      />

      <Card>
        <h2 className="mb-3 font-semibold">Run this agent</h2>
        <RunForm action={startRun.bind(null, id)} />
      </Card>

      <h2 className="mt-8 mb-3 font-semibold">Recent runs</h2>
      {runs?.length ? (
        <RunsTable runs={runs as unknown as RunRow[]} />
      ) : (
        <EmptyState title="This agent hasn't run yet" />
      )}

      <h2 className="mt-8 mb-3 font-semibold">Configuration</h2>
      <Card>
        <AgentForm
          agent={agent as Agent}
          action={updateAgent.bind(null, id)}
          submitLabel="Save changes"
        />
      </Card>
    </>
  );
}


export default function AgentPage(props: PageProps<"/agents/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AgentPageContent {...props} />
    </Suspense>
  );
}
