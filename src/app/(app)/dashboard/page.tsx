import { Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { getContext } from "@/lib/workspace";
import { RUN_ROW_SELECT, RunsTable, type RunRow } from "../runs-table";

export default async function DashboardPage() {
  const { supabase, workspace } = await getContext();

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [{ count: agentCount }, { data: monthRuns }, { data: recent }] = await Promise.all([
    supabase.from("agents").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id),
    supabase
      .from("runs")
      .select("status, input_tokens, output_tokens")
      .eq("workspace_id", workspace.id)
      .gte("created_at", monthStart.toISOString()),
    supabase
      .from("runs")
      .select(RUN_ROW_SELECT)
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const runs = monthRuns ?? [];
  const finished = runs.filter((r) => r.status === "succeeded" || r.status === "failed");
  const succeeded = runs.filter((r) => r.status === "succeeded").length;
  const tokens = runs.reduce((n, r) => n + r.input_tokens + r.output_tokens, 0);
  const pct = Math.min(100, Math.round((tokens / Math.max(1, workspace.monthly_token_limit)) * 100));

  const stats = [
    { label: "Agents", value: agentCount ?? 0 },
    { label: "Runs this month", value: runs.length },
    {
      label: "Success rate",
      value: finished.length ? `${Math.round((succeeded / finished.length) * 100)}%` : "—",
    },
    { label: "Tokens this month", value: tokens.toLocaleString() },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Overview of your agents and runs this month."
        actions={<LinkButton href="/agents/new">New agent</LinkButton>}
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <p className="text-sm text-zinc-500">{s.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</p>
          </Card>
        ))}
      </div>

      <Card className="mt-4">
        <div className="flex justify-between text-sm">
          <span className="font-medium">Monthly token budget</span>
          <span className="text-zinc-500 tabular-nums">
            {tokens.toLocaleString()} / {workspace.monthly_token_limit.toLocaleString()}
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div
            className={pct >= 90 ? "h-full bg-red-500" : "h-full bg-indigo-500"}
            style={{ width: `${pct}%` }}
          />
        </div>
      </Card>

      <h2 className="mt-8 mb-3 font-semibold">Recent runs</h2>
      {recent && recent.length > 0 ? (
        <RunsTable runs={recent as unknown as RunRow[]} />
      ) : (
        <EmptyState title="No runs yet">Create an agent and run it to see results here.</EmptyState>
      )}
    </>
  );
}
