import { Suspense } from "react";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { PageSkeleton } from "@/components/page-skeleton";
import { getContext } from "@/lib/workspace";

const DAYS = 14;

async function AnalyticsContent() {
  const { supabase, workspace } = await getContext();
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - (DAYS - 1));

  const { data } = await supabase
    .from("runs")
    .select("agent_id, status, input_tokens, output_tokens, created_at, started_at, finished_at, agents(name)")
    .eq("workspace_id", workspace.id)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false })
    .limit(5000);
  const runs = (data ?? []) as unknown as {
    agent_id: string;
    status: string;
    input_tokens: number;
    output_tokens: number;
    created_at: string;
    started_at: string | null;
    finished_at: string | null;
    agents: { name: string } | null;
  }[];

  // Runs per day (UTC)
  const days = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(since);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
  const perDay = Object.fromEntries(days.map((d) => [d, { ok: 0, fail: 0 }]));
  for (const r of runs) {
    const d = r.created_at.slice(0, 10);
    if (!perDay[d]) continue;
    if (r.status === "failed") perDay[d].fail++;
    else perDay[d].ok++;
  }
  const maxDay = Math.max(1, ...days.map((d) => perDay[d].ok + perDay[d].fail));

  // Per agent
  const byAgent = new Map<string, { name: string; runs: number; ok: number; fail: number; tokens: number; ms: number[] }>();
  for (const r of runs) {
    const a = byAgent.get(r.agent_id) ?? { name: r.agents?.name ?? "deleted", runs: 0, ok: 0, fail: 0, tokens: 0, ms: [] };
    a.runs++;
    if (r.status === "succeeded") a.ok++;
    if (r.status === "failed") a.fail++;
    a.tokens += r.input_tokens + r.output_tokens;
    if (r.started_at && r.finished_at) a.ms.push(new Date(r.finished_at).getTime() - new Date(r.started_at).getTime());
    byAgent.set(r.agent_id, a);
  }
  const agents = [...byAgent.values()].sort((a, b) => b.runs - a.runs);
  const totalTokens = runs.reduce((n, r) => n + r.input_tokens + r.output_tokens, 0);
  const finished = runs.filter((r) => r.status === "succeeded" || r.status === "failed");
  const avgMs = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const allMs = runs.flatMap((r) =>
    r.started_at && r.finished_at ? [new Date(r.finished_at).getTime() - new Date(r.started_at).getTime()] : [],
  );

  return (
    <>
      <PageHeader title="Analytics" description={`Agent runs over the last ${DAYS} days.`} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Runs" value={runs.length} />
        <Stat
          label="Success rate"
          value={finished.length ? `${Math.round((finished.filter((r) => r.status === "succeeded").length / finished.length) * 100)}%` : "—"}
        />
        <Stat label="Avg latency" value={allMs.length ? `${(avgMs(allMs) / 1000).toFixed(1)} s` : "—"} />
        <Stat label="Tokens" value={totalTokens.toLocaleString()} />
      </div>

      <Card className="mt-4">
        <p className="mb-4 text-sm font-medium">Runs per day</p>
        <div className="flex h-40 items-end gap-1.5" role="img" aria-label="Runs per day chart">
          {days.map((d) => {
            const { ok, fail } = perDay[d];
            return (
              <div key={d} className="flex h-full flex-1 flex-col justify-end" title={`${d}: ${ok} ok, ${fail} failed`}>
                {fail > 0 && <div className="rounded-t bg-red-400" style={{ height: `${(fail / maxDay) * 100}%` }} />}
                <div
                  className={ok > 0 ? "bg-indigo-500" + (fail ? "" : " rounded-t") : ""}
                  style={{ height: `${(ok / maxDay) * 100}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between text-xs text-zinc-500">
          <span>{days[0].slice(5)}</span>
          <span>
            <span className="mr-1 inline-block size-2 rounded-sm bg-indigo-500" />succeeded
            <span className="mr-1 ml-3 inline-block size-2 rounded-sm bg-red-400" />failed
          </span>
          <span>{days[DAYS - 1].slice(5)}</span>
        </div>
      </Card>

      <h2 className="mt-8 mb-3 font-semibold">By agent</h2>
      {agents.length === 0 ? (
        <EmptyState title="No runs in this period" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs text-zinc-500 uppercase dark:border-zinc-800">
              <tr>
                <th className="px-4 py-2.5 font-medium">Agent</th>
                <th className="px-4 py-2.5 text-right font-medium">Runs</th>
                <th className="px-4 py-2.5 text-right font-medium">Success</th>
                <th className="px-4 py-2.5 text-right font-medium">Avg latency</th>
                <th className="px-4 py-2.5 text-right font-medium">Tokens</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {agents.map((a) => (
                <tr key={a.name + a.runs} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                  <td className="px-4 py-2.5 font-medium">{a.name}</td>
                  <td className="px-4 py-2.5 text-right">{a.runs}</td>
                  <td className="px-4 py-2.5 text-right">
                    {a.ok + a.fail ? `${Math.round((a.ok / (a.ok + a.fail)) * 100)}%` : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right">{a.ms.length ? `${(avgMs(a.ms) / 1000).toFixed(1)} s` : "—"}</td>
                  <td className="px-4 py-2.5 text-right">{a.tokens.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </Card>
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AnalyticsContent />
    </Suspense>
  );
}
