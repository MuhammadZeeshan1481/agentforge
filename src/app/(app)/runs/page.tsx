import type { Metadata } from "next";
import { Suspense } from "react";
import { History } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";
import { PageSkeleton } from "@/components/page-skeleton";
import { getContext } from "@/lib/workspace";
import { RUN_ROW_SELECT, RunsTable, type RunRow } from "../runs-table";

export const metadata: Metadata = { title: "Run history" };

async function RunsContent() {
  const { supabase, workspace } = await getContext();
  const { data } = await supabase.from("runs").select(RUN_ROW_SELECT).eq("workspace_id", workspace.id).order("created_at", { ascending: false }).limit(100);
  return (
    <>
      <PageHeader title="Run history" description="Every agent run in this workspace, newest first (last 100)." />
      {data?.length ? <RunsTable runs={data as unknown as RunRow[]} /> : <EmptyState icon={<History />} title="No runs yet" description="Runs appear here as soon as an agent or workflow starts." />}
    </>
  );
}

export default function RunsPage() {
  return <Suspense fallback={<PageSkeleton />}><RunsContent /></Suspense>;
}
