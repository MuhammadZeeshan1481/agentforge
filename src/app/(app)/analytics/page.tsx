import { Suspense } from "react";
import type { Metadata } from "next";
import { BarChart3, Coins, Gauge, Play, Timer } from "lucide-react";
import { Card, DataTable, EmptyState, PageHeader, Section, StatCard } from "@/components/ui";
import { PageSkeleton } from "@/components/page-skeleton";
import { getContext } from "@/lib/workspace";

export const metadata: Metadata = { title: "Analytics" };
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
        <StatCard label="Runs" value={runs.length} icon={<Play />} />
        <StatCard
          label="Success rate"
          icon={<Gauge />}
          value={finished.length ? `${Math.round((finished.filter((r) => r.status === "succeeded").length / finished.length) * 100)}%` : "—"}
        />
        <StatCard label="Avg latency" icon={<Timer />} value={allMs.length ? `${(avgMs(allMs) / 1000).toFixed(1)} s` : "—"} />
        <StatCard label="Tokens" icon={<Coins />} value={totalTokens.toLocaleString()} />
      </div>

      <Card className="mt-6 p-5">
        <p className="mb-4 text-sm font-medium">Runs per day</p>
        <div className="flex h-40 items-end gap-1.5" role="img" aria-label="Runs per day chart">
          {days.map((d) => {
            const { ok, fail } = perDay[d];
            return (
              <div key={d} className="flex h-full flex-1 flex-col justify-end" title={`${d}: ${ok} ok, ${fail} failed`}>
                {fail > 0 && <div className="rounded-t bg-destructive/70" style={{ height: `${(fail / maxDay) * 100}%` }} />}
                <div
                  className={ok > 0 ? "bg-gradient-to-t from-indigo-500 to-violet-400" + (fail ? "" : " rounded-t") : ""}
                  style={{ height: `${(ok / maxDay) * 100}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>{days[0].slice(5)}</span>
          <span>
            <span className="mr-1 inline-block size-2 rounded-sm bg-indigo-500" />succeeded
            <span className="mr-1 ml-3 inline-block size-2 rounded-sm bg-destructive/70" />failed
          </span>
          <span>{days[DAYS - 1].slice(5)}</span>
        </div>
      </Card>

      <Section title="By agent">
      {agents.length === 0 ? (
        <EmptyState icon={<BarChart3 />} title="No runs in this period" />
      ) : (
          <DataTable>
            <thead>
              <tr>
                <th >Agent</th>
                <th className="text-right">Runs</th>
                <th className="text-right">Success</th>
                <th className="text-right">Avg latency</th>
                <th className="text-right">Tokens</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {agents.map((a) => (
                <tr key={a.name + a.runs}>
                  <td >{a.name}</td>
                  <td className="text-right">{a.runs}</td>
                  <td className="text-right">
                    {a.ok + a.fail ? `${Math.round((a.ok / (a.ok + a.fail)) * 100)}%` : "—"}
                  </td>
                  <td className="text-right">{a.ms.length ? `${(avgMs(a.ms) / 1000).toFixed(1)} s` : "—"}</td>
                  <td className="text-right">{a.tokens.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
      )}
      </Section>
    </>
  );
}


export default function AnalyticsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AnalyticsContent />
    </Suspense>
  );
}
