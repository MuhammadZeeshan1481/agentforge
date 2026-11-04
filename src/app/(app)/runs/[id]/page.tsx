import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { History } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { PageSkeleton } from "@/components/page-skeleton";
import { LocalTime } from "@/components/local-time";
import { getContext } from "@/lib/workspace";
import type { Run, RunStep } from "@/lib/types";
import { RunLive } from "./run-live";

export const metadata: Metadata = { title: "Run" };

async function RunPageContent({ params }: PageProps<"/runs/[id]">) {
  const { id } = await params;
  const { supabase } = await getContext();
  const { data: run } = await supabase.from("runs").select("*, agents(id, name)").eq("id", id).maybeSingle();
  if (!run) notFound();
  const { data: steps } = await supabase.from("run_steps").select("*").eq("run_id", id).order("id", { ascending: true });
  const agent = run.agents as { id: string; name: string } | null;
  return (
    <>
      <PageHeader
        icon={<History className="size-5" />}
        title={agent?.name ?? "Agent run"}
        description={<>Run started <LocalTime iso={run.created_at} /></>}
        back={run.workflow_run_id ? { href: `/workflow-runs/${run.workflow_run_id}`, label: "Workflow run" } : agent ? { href: `/agents/${agent.id}`, label: agent.name } : { href: "/runs", label: "Run history" }}
      />
      <RunLive initialRun={run as Run} initialSteps={(steps ?? []) as RunStep[]} />
    </>
  );
}

export default function RunPage(props: PageProps<"/runs/[id]">) {
  return <Suspense fallback={<PageSkeleton />}><RunPageContent {...props} /></Suspense>;
}
