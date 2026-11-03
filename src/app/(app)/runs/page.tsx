import { EmptyState, PageHeader } from "@/components/ui";
import { getContext } from "@/lib/workspace";
import { RUN_ROW_SELECT, RunsTable, type RunRow } from "../runs-table";

export default async function RunsPage() {
  const { supabase, workspace } = await getContext();
  const { data } = await supabase
    .from("runs")
    .select(RUN_ROW_SELECT)
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <>
      <PageHeader title="Run history" description="The latest 100 runs in this workspace." />
      {data && data.length > 0 ? (
        <RunsTable runs={data as unknown as RunRow[]} />
      ) : (
        <EmptyState title="No runs yet" />
      )}
    </>
  );
}
