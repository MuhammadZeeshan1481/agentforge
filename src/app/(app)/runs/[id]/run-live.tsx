"use client";
import { useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";
import { AlertTriangle, Bot, Info, Wrench, CornerDownRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card, StatusBadge, duration } from "@/components/ui";
import type { Run, RunStep } from "@/lib/types";

const icons = {
  info: Info,
  llm: Bot,
  tool_call: Wrench,
  tool_result: CornerDownRight,
  error: AlertTriangle,
};

const titles: Record<RunStep["kind"], (c: Record<string, unknown>) => string> = {
  info: (c) => String(c.message ?? "Info"),
  llm: () => "Model output",
  tool_call: (c) => `Calling ${c.tool}`,
  tool_result: (c) => `Result from ${c.tool}`,
  error: () => "Error",
};

function pretty(v: unknown) {
  if (typeof v === "string") return v;
  return JSON.stringify(v, null, 2);
}

function StepBody({ step }: { step: RunStep }) {
  const c = step.content;
  const body =
    step.kind === "llm"
      ? c.text
      : step.kind === "tool_call"
        ? c.input
        : step.kind === "tool_result"
          ? c.output
          : step.kind === "error"
            ? c.message
            : c.usage
              ? { steps: c.steps, usage: c.usage }
              : c.tools
                ? { tools: c.tools }
                : null;
  if (body == null || body === "") return null;
  return (
    <pre className="mt-2 max-h-80 overflow-auto rounded bg-zinc-50 p-3 text-xs whitespace-pre-wrap break-words dark:bg-zinc-950">
      {pretty(body)}
    </pre>
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
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "run_steps", filter: `run_id=eq.${initialRun.id}` },
        (payload) =>
          setSteps((prev) =>
            prev.some((s) => s.id === (payload.new as RunStep).id)
              ? prev
              : [...prev, payload.new as RunStep].sort((a, b) => a.id - b.id),
          ),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "runs", filter: `id=eq.${initialRun.id}` },
        (payload) => setRun((prev) => ({ ...prev, ...(payload.new as Run) })),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, initialRun.id]);

  // Fallback polling while active, in case Realtime isn't enabled/connected.
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

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="min-w-0 space-y-4">
        <Card>
          <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">Input</p>
          <p className="mt-1 text-sm whitespace-pre-wrap">{run.input || "—"}</p>
        </Card>

        <div>
          <p className="mb-2 text-xs font-medium tracking-wide text-zinc-500 uppercase">Steps</p>
          <ol className="space-y-2">
            {steps.map((s) => {
              const Icon = icons[s.kind] ?? Info;
              return (
                <li
                  key={s.id}
                  className={clsx(
                    "rounded-lg border bg-white p-3 dark:bg-zinc-900",
                    s.kind === "error"
                      ? "border-red-300 dark:border-red-900"
                      : "border-zinc-200 dark:border-zinc-800",
                  )}
                >
                  <div className="flex items-center gap-2 text-sm">
                    <Icon
                      className={clsx("size-4", s.kind === "error" ? "text-red-500" : "text-zinc-400")}
                    />
                    <span className="font-medium">{titles[s.kind]?.(s.content) ?? s.kind}</span>
                    <span className="ml-auto text-xs text-zinc-400">
                      {new Date(s.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <StepBody step={s} />
                </li>
              );
            })}
            {active && (
              <li className="flex items-center gap-2 rounded-lg border border-dashed border-zinc-300 p-3 text-sm text-zinc-500 dark:border-zinc-700">
                <span className="size-2 animate-pulse rounded-full bg-blue-500" />
                {run.status === "queued" ? "Waiting to start…" : "Working…"}
              </li>
            )}
          </ol>
        </div>

        {(run.output || run.error) && (
          <Card className={run.error ? "border-red-300 dark:border-red-900" : undefined}>
            <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
              {run.error ? "Error" : "Final output"}
            </p>
            <p className="mt-2 text-sm whitespace-pre-wrap">{run.error ?? run.output}</p>
          </Card>
        )}
      </div>

      <Card className="h-fit space-y-3 text-sm">
        <Row label="Status">
          <StatusBadge status={run.status} />
        </Row>
        <Row label="Model">{run.model ?? "—"}</Row>
        <Row label="Input tokens">{run.input_tokens.toLocaleString()}</Row>
        <Row label="Output tokens">{run.output_tokens.toLocaleString()}</Row>
        <Row label="Duration">{duration(run.started_at, run.finished_at)}</Row>
        <Row label="Steps logged">{steps.length}</Row>
      </Card>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-zinc-500">{label}</span>
      <span className="text-right tabular-nums">{children}</span>
    </div>
  );
}
