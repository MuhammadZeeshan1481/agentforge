import Link from "next/link";
import { Badge, DataTable, StatusBadge, duration } from "@/components/ui";
import { LocalTime } from "@/components/local-time";

export type WorkflowRunRow = {
  id: string;
  status: string;
  trigger: string;
  input: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  workflows: { name: string } | null;
};

export const WORKFLOW_RUN_SELECT =
  "id, status, trigger, input, created_at, started_at, finished_at, workflows(name)";

export function WorkflowRunsTable({ runs }: { runs: WorkflowRunRow[] }) {
  return (
    <DataTable>
      <thead>
        <tr>
          <th>Workflow</th>
          <th>Input</th>
          <th>Trigger</th>
          <th>Status</th>
          <th className="text-right">Duration</th>
          <th className="text-right">Started</th>
        </tr>
      </thead>
      <tbody>
        {runs.map((r) => (
          <tr key={r.id} className="relative">
            <td className="font-medium">
              <Link href={`/workflow-runs/${r.id}`} className="after:absolute after:inset-0">{r.workflows?.name ?? "Deleted workflow"}</Link>
            </td>
            <td className="max-w-xs truncate text-muted-foreground">{r.input || "—"}</td>
            <td><Badge variant="outline" className="capitalize">{r.trigger}</Badge></td>
            <td><StatusBadge status={r.status} /></td>
            <td className="text-right text-muted-foreground tabular-nums">{duration(r.started_at, r.finished_at)}</td>
            <td className="text-right whitespace-nowrap text-muted-foreground"><LocalTime iso={r.created_at} format="short" /></td>
          </tr>
        ))}
      </tbody>
    </DataTable>
  );
}
