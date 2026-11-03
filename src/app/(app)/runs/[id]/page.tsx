import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { getContext } from "@/lib/workspace";
import type { Run, RunStep } from "@/lib/types";
import { RunLive } from "./run-live";

export default async function RunPage({ params }: PageProps<"/runs/[id]">) {
  const { id } = await params;
  const { supabase } = await getContext();
  const { data: run } = await supabase
    .from("runs")
    .select("*, agents(id, name)")
    .eq("id", id)
    .maybeSingle();
  if (!run) notFound();

  const { data: steps } = await supabase
    .from("run_steps")
    .select("*")
    .eq("run_id", id)
    .order("id", { ascending: true });

  const agent = run.agents as { id: string; name: string } | null;
  return (
    <>
      <PageHeader
        title={`Run · ${agent?.name ?? "Agent"}`}
        description={new Date(run.created_at).toLocaleString()}
        actions={
          agent && (
            <Link href={`/agents/${agent.id}`} className="text-sm text-indigo-600 hover:underline">
              ← Back to agent
            </Link>
          )
        }
      />
      <RunLive initialRun={run as Run} initialSteps={(steps ?? []) as RunStep[]} />
    </>
  );
}
