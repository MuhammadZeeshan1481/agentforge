"use client";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowUpRight, Bot, Check, CheckCircle2, CircleDashed, Filter, Loader2, ShieldCheck, X } from "lucide-react";
import { cn, duration } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, StatusBadge } from "@/components/ui";
import { stepLabel, type StepOutput, type WorkflowStep } from "@/lib/workflows";
import { decide } from "../../workflows/actions";

type WorkflowRun = {
  id: string; status: string; trigger: string; input: string; steps: WorkflowStep[]; current_step: number;
  outputs: StepOutput[]; output: string | null; error: string | null; approval_message: string | null;
  started_at: string | null; finished_at: string | null;
};
const icons = { agent: Bot, approval: ShieldCheck, condition: Filter };
const stateTone: Record<string, string> = {
  succeeded: "bg-success text-white", passed: "bg-success text-white", approved: "bg-success text-white",
  failed: "bg-destructive text-white", rejected: "bg-destructive text-white", stopped: "bg-warning text-black",
  running: "bg-primary text-primary-foreground", waiting: "bg-warning text-black", pending: "bg-muted text-muted-foreground",
};

export function WorkflowRunLive({ initial, agentNames, canDecide }: { initial: WorkflowRun; agentNames: Record<string, string>; canDecide: boolean }) {
  const [wr, setWr] = useState(initial);
  const [pending, startTransition] = useTransition();
  const supabase = useMemo(() => createClient(), []);
  const active = wr.status === "queued" || wr.status === "running";

  const refresh = async () => {
    const { data } = await supabase.from("workflow_runs").select("*").eq("id", initial.id).single();
    if (data) setWr(data as WorkflowRun);
  };
  const onDecide = (approve: boolean) =>
    startTransition(async () => {
      await decide(wr.id, approve);
      toast.success(approve ? "Approved — continuing the workflow" : "Rejected");
      await refresh();
    });

  useEffect(() => {
    const channel = supabase
      .channel(`wfrun-${initial.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "workflow_runs", filter: `id=eq.${initial.id}` }, (p) => setWr((prev) => ({ ...prev, ...(p.new as WorkflowRun) })))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, initial.id]);

  useEffect(() => {
    if (!active) return;
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0 space-y-6">
        <Card className="p-5">
          <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">Input</p>
          <p className="mt-2 text-sm whitespace-pre-wrap">{wr.input || "—"}</p>
        </Card>

        <ol className="space-y-0">
          {wr.steps.map((step, i) => {
            const out = wr.outputs?.[i];
            const Icon = icons[step.type];
            const isCurrent = i === wr.current_step && (active || wr.status === "waiting_approval");
            const state: string = out?.status ?? (isCurrent ? (wr.status === "waiting_approval" ? "waiting" : "running") : "pending");
            const last = i === wr.steps.length - 1;
            return (
              <li key={i} className="relative flex gap-4 pb-6">
                {!last && <span className="absolute top-10 bottom-0 left-[19px] w-px bg-border" />}
                <span className={cn("relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full", stateTone[state])}>
                  {state === "running" ? <Loader2 className="size-4 animate-spin" /> : state === "pending" ? <CircleDashed className="size-4" /> : ["failed", "rejected"].includes(state) ? <X className="size-4" /> : state === "waiting" ? <ShieldCheck className="size-4" /> : <Check className="size-4" />}
                </span>
                <Card className={cn("min-w-0 flex-1 p-4", isCurrent && "ring-2 ring-primary/30")}>
                  <div className="flex items-center gap-2 text-sm">
                    <Icon className="size-4 text-muted-foreground" />
                    <span className="font-medium">{stepLabel(step, agentNames)}</span>
                    <span className="ml-auto text-xs font-medium text-muted-foreground capitalize">{state}</span>
                  </div>
                  {out?.output && <pre className="mt-3 max-h-64 overflow-auto rounded-lg border bg-muted/40 p-3 text-xs leading-relaxed whitespace-pre-wrap">{out.output}</pre>}
                  {out?.note && <p className="mt-2 text-xs text-muted-foreground">{out.note}</p>}
                  {out?.run_id && (
                    <Link href={`/runs/${out.run_id}`} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                      Execution trace <ArrowUpRight className="size-3" />
                    </Link>
                  )}
                  {wr.status === "waiting_approval" && isCurrent && (
                    <div className="mt-4 rounded-lg border border-warning/40 bg-warning/[0.06] p-4">
                      <p className="text-sm font-medium">Approval needed</p>
                      <p className="mt-1 text-sm whitespace-pre-wrap text-muted-foreground">{wr.approval_message}</p>
                      {canDecide ? (
                        <div className="mt-4 flex gap-2">
                          <Button loading={pending} onClick={() => onDecide(true)}>{!pending && <Check />} Approve</Button>
                          <Button variant="outline" disabled={pending} onClick={() => onDecide(false)}><X /> Reject</Button>
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-muted-foreground">Waiting for an editor to approve.</p>
                      )}
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ol>

        {(wr.output || wr.error) && !active && wr.status !== "waiting_approval" && (
          <Card className={cn("p-5", wr.error ? "border-destructive/40 bg-destructive/[0.03]" : "border-success/30 bg-success/[0.03]")}>
            <p className={cn("flex items-center gap-2 text-sm font-medium", wr.error ? "text-destructive" : "text-success")}>
              {wr.error ? <AlertTriangle className="size-4" /> : <CheckCircle2 className="size-4" />} {wr.error ? "Workflow failed" : "Final output"}
            </p>
            <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap">{wr.error ?? wr.output}</p>
          </Card>
        )}
      </div>

      <Card className="h-fit divide-y text-sm lg:sticky lg:top-6">
        {[
          ["Status", <StatusBadge key="s" status={wr.status} />],
          ["Trigger", <span key="t" className="capitalize">{wr.trigger}</span>],
          ["Progress", `${Math.min(wr.current_step, wr.steps.length)} / ${wr.steps.length}`],
          ["Duration", duration(wr.started_at, wr.finished_at)],
        ].map(([label, value]) => (
          <div key={String(label)} className="flex items-center justify-between gap-3 px-5 py-3">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium tabular-nums">{value}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}
