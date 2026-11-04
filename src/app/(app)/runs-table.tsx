import Link from "next/link";
import { DataTable, StatusBadge, duration } from "@/components/ui";
import { LocalTime } from "@/components/local-time";

export type RunRow = {
  id: string;
  status: string;
  input: string;
  input_tokens: number;
  output_tokens: number;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  agents: { name: string } | null;
};

export const RUN_ROW_SELECT =
  "id, status, input, input_tokens, output_tokens, created_at, started_at, finished_at, agents(name)";

export function RunsTable({ runs, hideAgent }: { runs: RunRow[]; hideAgent?: boolean }) {
  return (
    <DataTable>
      <thead>
        <tr>
          {!hideAgent && <th>Agent</th>}
          <th>Input</th>
          <th>Status</th>
          <th className="text-right">Tokens</th>
          <th className="text-right">Duration</th>
          <th className="text-right">Started</th>
        </tr>
      </thead>
      <tbody>
        {runs.map((r) => (
          <tr key={r.id} className="group relative">
            {!hideAgent && (
              <td className="font-medium">
                <Link href={`/runs/${r.id}`} className="after:absolute after:inset-0">{r.agents?.name ?? "Deleted agent"}</Link>
              </td>
            )}
            <td className="max-w-sm truncate text-muted-foreground">
              {hideAgent ? <Link href={`/runs/${r.id}`} className="after:absolute after:inset-0">{r.input || "—"}</Link> : r.input || "—"}
            </td>
            <td><StatusBadge status={r.status} /></td>
            <td className="text-right tabular-nums">{(r.input_tokens + r.output_tokens).toLocaleString()}</td>
            <td className="text-right text-muted-foreground tabular-nums">{duration(r.started_at, r.finished_at)}</td>
            <td className="text-right whitespace-nowrap text-muted-foreground"><LocalTime iso={r.created_at} format="short" /></td>
          </tr>
        ))}
      </tbody>
    </DataTable>
  );
}
