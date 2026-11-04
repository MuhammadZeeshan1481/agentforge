"use client";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bot, CheckCircle2, ChevronDown, CornerDownRight, Copy, Info, Loader2, Wrench } from "lucide-react";
import { toast } from "sonner";
import { cn, duration } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Card, StatusBadge } from "@/components/ui";
import { LocalTime } from "@/components/local-time";
import { TOOL_CATALOG, type ToolId } from "@/lib/tools/catalog";
import type { Run, RunStep } from "@/lib/types";

const kindStyle: Record<RunStep["kind"], { icon: typeof Info; tone: string }> = {
  info: { icon: Info, tone: "bg-muted text-muted-foreground" },
  llm: { icon: Bot, tone: "bg-primary/10 text-primary" },
  tool_call: { icon: Wrench, tone: "bg-sky-500/10 text-sky-600 dark:text-sky-400" },
  tool_result: { icon: CornerDownRight, tone: "bg-success/12 text-success" },
  error: { icon: AlertTriangle, tone: "bg-destructive/12 text-destructive" },
};

const toolLabel = (t: unknown) => TOOL_CATALOG[t as ToolId]?.label ?? (t === "save_memory" ? "Save memory" : String(t));
const titles: Record<RunStep["kind"], (c: Record<string, unknown>) => string> = {
  info: (c) => String(c.message ?? "Info"),
  llm: () => "Model response",
  tool_call: (c) => `Called ${toolLabel(c.tool)}`,
  tool_result: (c) => `${toolLabel(c.tool)} returned`,
  error: () => "Error",
};

const pretty = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v, null, 2));

function stepBody(step: RunStep) {
  const c = step.content;
  if (step.kind === "llm") return c.text;
  if (step.kind === "tool_call") return c.input;
  if (step.kind === "tool_result") return c.output;
  if (step.kind === "error") return c.message;
  if (c.usage) return { steps: c.steps, usage: c.usage };
  if (c.tools) return { tools: c.tools };
  return null;
}

function Step({ step, last }: { step: RunStep; last: boolean }) {
  const body = stepBody(step);
  const [open, setOpen] = useState(step.kind !== "info");
  const { icon: Icon, tone } = kindStyle[step.kind] ?? kindStyle.info;
  return (
    <li className="relative flex gap-4 pb-6">
      {!last && <span className="absolute top-9 bottom-0 left-[17px] w-px bg-border" />}
      <span className={cn("relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full", tone)}><Icon className="size-4" /></span>
      <div className="min-w-0 flex-1 pt-1.5">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 text-left text-sm" disabled={body == null || body === ""}>
          <span className="font-medium">{titles[step.kind]?.(step.content) ?? step.kind}</span>
          <span className="ml-auto shrink-0 text-xs text-muted-foreground"><LocalTime iso={step.created_at} format="time" /></span>
          {body != null && body !== "" && <ChevronDown className={cn("size-4 text-muted-foreground transition", open && "rotate-180")} />}
        </button>
        {open && body != null && body !== "" && (
          <pre className="mt-2 max-h-80 overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap">{pretty(body)}</pre>
        )}
      </div>
    </li>
  );
}

export function RunLive({ initialRun, initialSteps }: { initialRun: Run; initialSteps: RunStep[] }) {
  const [run, setRun] = useState(initialRun);
  const [steps, setSteps] = useState(initialSteps);
  const supabase = useMemo(() => createClient(), []);
  const active = run.status === "queued" || run.status === "running";

  useEffect(() => {
    const channel = supabase
      .channel(`run-${initialRun.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "run_steps", filter: `run_id=eq.${initialRun.id}` }, (payload) =>
        setSteps((prev) => (prev.some((s) => s.id === (payload.new as RunStep).id) ? prev : [...prev, payload.new as RunStep].sort((a, b) => a.id - b.id))),
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "runs", filter: `id=eq.${initialRun.id}` }, (payload) =>
        setRun((prev) => ({ ...prev, ...(payload.new as Run) })),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, initialRun.id]);

  // Polling fallback while active, in case Realtime isn't connected.
  useEffect(() => {
    if (!active) return;
    const t = setInterval(async () => {
      const [{ data: r }, { data: s }] = await Promise.all([
        supabase.from("runs").select("*").eq("id", initialRun.id).single(),
        supabase.from("run_steps").select("*").eq("run_id", initialRun.id).order("id"),
      ]);
      if (r) setRun(r as Run);
      if (s) setSteps(s as RunStep[]);
    }, 3000);
    return () => clearInterval(t);
  }, [active, supabase, initialRun.id]);

  const toolCalls = steps.filter((s) => s.kind === "tool_call").length;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-6">
        <Card className="p-5">
          <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">Task</p>
          <p className="mt-2 text-sm whitespace-pre-wrap">{run.input || "—"}</p>
        </Card>

        {(run.output || run.error) && !active && (
          <Card className={cn("p-5", run.error ? "border-destructive/40 bg-destructive/[0.03]" : "border-success/30 bg-success/[0.03]")}>
            <div className="flex items-center justify-between gap-2">
              <p className={cn("flex items-center gap-2 text-sm font-medium", run.error ? "text-destructive" : "text-success")}>
                {run.error ? <AlertTriangle className="size-4" /> : <CheckCircle2 className="size-4" />}
                {run.error ? "Run failed" : "Result"}
              </p>
              {!run.error && (
                <button
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => navigator.clipboard.writeText(run.output ?? "").then(() => toast.success("Copied"))}
                >
                  <Copy className="size-3.5" /> Copy
                </button>
              )}
            </div>
            <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap">{run.error ?? run.output}</p>
          </Card>
        )}

        <div>
          <p className="mb-4 text-xs font-medium tracking-wider text-muted-foreground uppercase">Execution trace</p>
          <ol>
            {steps.map((s, i) => <Step key={s.id} step={s} last={i === steps.length - 1 && !active} />)}
            {active && (
              <li className="flex items-center gap-4">
                <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary"><Loader2 className="size-4 animate-spin" /></span>
                <span className="text-sm text-muted-foreground">{run.status === "queued" ? "Waiting to start…" : "Agent is working…"}</span>
              </li>
            )}
          </ol>
        </div>
      </div>

      <Card className="h-fit divide-y text-sm lg:sticky lg:top-6">
        {[
          ["Status", <StatusBadge key="s" status={run.status} />],
          ["Model", run.model ?? "—"],
          ["Tool calls", toolCalls],
          ["Input tokens", run.input_tokens.toLocaleString()],
          ["Output tokens", run.output_tokens.toLocaleString()],
          ["Duration", duration(run.started_at, run.finished_at)],
          ["Started", run.started_at ? <LocalTime key="t" iso={run.started_at} format="short" /> : "—"],
        ].map(([label, value]) => (
          <div key={String(label)} className="flex items-center justify-between gap-3 px-5 py-3">
            <span className="text-muted-foreground">{label}</span>
            <span className="text-right font-medium tabular-nums">{value}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}
