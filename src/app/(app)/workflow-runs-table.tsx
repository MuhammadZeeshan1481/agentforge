import Link from "next/link";
import { StatusBadge, duration } from "@/components/ui";
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
    <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-zinc-200 text-xs text-zinc-500 uppercase dark:border-zinc-800">
          <tr>
            <th className="px-4 py-2.5 font-medium">Workflow</th>
            <th className="px-4 py-2.5 font-medium">Input</th>
            <th className="px-4 py-2.5 font-medium">Trigger</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
            <th className="px-4 py-2.5 text-right font-medium">Duration</th>
            <th className="px-4 py-2.5 text-right font-medium">When</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50">
              <td className="px-4 py-2.5 font-medium">
                <Link href={`/workflow-runs/${r.id}`} className="hover:underline">{r.workflows?.name ?? "—"}</Link>
              </td>
              <td className="max-w-xs truncate px-4 py-2.5 text-zinc-500">{r.input || "—"}</td>
              <td className="px-4 py-2.5 text-zinc-500">{r.trigger}</td>
              <td className="px-4 py-2.5"><StatusBadge status={r.status} /></td>
              <td className="px-4 py-2.5 text-right tabular-nums">{duration(r.started_at, r.finished_at)}</td>
              <td className="px-4 py-2.5 text-right whitespace-nowrap text-zinc-500"><LocalTime iso={r.created_at} format="short" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
