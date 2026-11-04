"use client";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { clsx } from "clsx";
import { Bot, Check, Filter, ShieldCheck, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, StatusBadge, duration } from "@/components/ui";
import { stepLabel, type StepOutput, type WorkflowStep } from "@/lib/workflows";
import { decide } from "../../workflows/actions";

type WorkflowRun = {
  id: string;
  status: string;
  trigger: string;
  input: string;
  steps: WorkflowStep[];
  current_step: number;
  outputs: StepOutput[];
  output: string | null;
  error: string | null;
  approval_message: string | null;
  started_at: string | null;
  finished_at: string | null;
};

const icons = { agent: Bot, approval: ShieldCheck, condition: Filter };

export function WorkflowRunLive({
  initial,
  agentNames,
  canDecide,
}: {
  initial: WorkflowRun;
  agentNames: Record<string, string>;
  canDecide: boolean;
}) {
  const [wr, setWr] = useState(initial);
  const [pending, startTransition] = useTransition();
  const supabase = useMemo(() => createClient(), []);
  const active = wr.status === "queued" || wr.status === "running";

  const onDecide = (approve: boolean) =>
    startTransition(async () => {
      await decide(wr.id, approve);
      const { data } = await supabase.from("workflow_runs").select("*").eq("id", initial.id).single();
      if (data) setWr(data as WorkflowRun);
    });

  useEffect(() => {
    const channel = supabase
      .channel(`wfrun-${initial.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "workflow_runs", filter: `id=eq.${initial.id}` },
        (payload) => setWr((prev) => ({ ...prev, ...(payload.new as WorkflowRun) })),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, initial.id]);

  useEffect(() => {
    if (!active) return;
    const t = setInterval(async () => {
      const { data } = await supabase.from("workflow_runs").select("*").eq("id", initial.id).single();
      if (data) setWr(data as WorkflowRun);
    }, 3000);
    return () => clearInterval(t);
  }, [active, supabase, initial.id]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
      <div className="min-w-0 space-y-4">
        <Card>
          <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">Input</p>
          <p className="mt-1 text-sm whitespace-pre-wrap">{wr.input || "—"}</p>
        </Card>

        <ol className="space-y-2">
          {wr.steps.map((step, i) => {
            const out = wr.outputs?.[i];
            const Icon = icons[step.type];
            const isCurrent = i === wr.current_step && (active || wr.status === "waiting_approval");
            const state = out?.status ?? (isCurrent ? (wr.status === "waiting_approval" ? "waiting" : "running") : "pending");
            return (
              <li
                key={i}
                className={clsx(
                  "rounded-lg border bg-white p-3 dark:bg-zinc-900",
                  isCurrent ? "border-indigo-400" : "border-zinc-200 dark:border-zinc-800",
                )}
              >
                <div className="flex items-center gap-2 text-sm">
                  <span className="flex size-6 items-center justify-center rounded-full bg-zinc-100 text-xs dark:bg-zinc-800">{i + 1}</span>
                  <Icon className="size-4 text-zinc-400" />
                  <span className="font-medium">{stepLabel(step, agentNames)}</span>
                  <span className="ml-auto"><StepState state={state} /></span>
                </div>
                {out?.output && (
                  <pre className="mt-2 max-h-64 overflow-auto rounded bg-zinc-50 p-3 text-xs whitespace-pre-wrap dark:bg-zinc-950">{out.output}</pre>
                )}
                {out?.note && <p className="mt-2 text-xs text-zinc-500">{out.note}</p>}
                {out?.run_id && (
                  <Link href={`/runs/${out.run_id}`} className="mt-2 inline-block text-xs text-indigo-600 hover:underline">
                    View agent run steps →
                  </Link>
                )}
                {wr.status === "waiting_approval" && isCurrent && (
                  <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
                    <p className="text-sm">{wr.approval_message}</p>
                    {canDecide ? (
                      <div className="mt-3 flex gap-2">
                        <Button disabled={pending} onClick={() => onDecide(true)}>
                          <Check className="size-4" /> Approve
                        </Button>
                        <Button variant="secondary" disabled={pending} onClick={() => onDecide(false)}>
                          <X className="size-4" /> Reject
                        </Button>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-zinc-500">Waiting for an editor to approve.</p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>

        {(wr.output || wr.error) && !active && wr.status !== "waiting_approval" && (
          <Card className={wr.error ? "border-red-300 dark:border-red-900" : undefined}>
            <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">{wr.error ? "Error" : "Final output"}</p>
            <p className="mt-2 text-sm whitespace-pre-wrap">{wr.error ?? wr.output}</p>
          </Card>
        )}
      </div>

      <Card className="h-fit space-y-3 text-sm">
        <Row label="Status"><StatusBadge status={wr.status} /></Row>
        <Row label="Trigger">{wr.trigger}</Row>
        <Row label="Progress">{Math.min(wr.current_step, wr.steps.length)} / {wr.steps.length}</Row>
        <Row label="Duration">{duration(wr.started_at, wr.finished_at)}</Row>
      </Card>
    </div>
  );
}

function StepState({ state }: { state: string }) {
  const map: Record<string, string> = {
    succeeded: "text-emerald-600", passed: "text-emerald-600", approved: "text-emerald-600",
    failed: "text-red-600", rejected: "text-red-600", stopped: "text-amber-600",
    running: "text-blue-600", waiting: "text-amber-600", pending: "text-zinc-400",
  };
  return <span className={clsx("text-xs font-medium", map[state])}>{state}</span>;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-zinc-500">{label}</span>
      <span className="text-right tabular-nums">{children}</span>
    </div>
  );
}
