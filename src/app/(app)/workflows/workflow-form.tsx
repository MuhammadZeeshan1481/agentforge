"use client";
import { useActionState, useState } from "react";
import { ArrowDown, ArrowUp, Bot, Filter, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { Button, Input, Label, Select, Textarea } from "@/components/ui";
import type { WorkflowStep } from "@/lib/workflows";
import type { FormState } from "./actions";

type AgentOption = { id: string; name: string };
type WorkflowDefaults = {
  name?: string;
  description?: string;
  trigger_type?: "manual" | "webhook" | "schedule";
  schedule_interval?: string | null;
  schedule_input?: string;
  enabled?: boolean;
  steps?: WorkflowStep[];
};

export function WorkflowForm({
  workflow,
  agents,
  action,
  submitLabel,
}: {
  workflow?: WorkflowDefaults;
  agents: AgentOption[];
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [trigger, setTrigger] = useState(workflow?.trigger_type ?? "manual");
  const [steps, setSteps] = useState<WorkflowStep[]>(
    workflow?.steps?.length
      ? workflow.steps
      : [{ type: "agent", agent_id: agents[0]?.id ?? "", input: "{{input}}" }],
  );

  const update = (i: number, patch: Partial<WorkflowStep>) =>
    setSteps(steps.map((s, j) => (j === i ? ({ ...s, ...patch } as WorkflowStep) : s)));
  const move = (i: number, d: -1 | 1) => {
    const next = [...steps];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setSteps(next);
  };
  const add = (type: WorkflowStep["type"]) =>
    setSteps([
      ...steps,
      type === "agent"
        ? { type, agent_id: agents[0]?.id ?? "", input: "{{previous}}" }
        : type === "approval"
          ? { type, message: "Review the output above before continuing." }
          : { type, mode: "contains", value: "" },
    ]);

  if (!agents.length) {
    return <p className="text-sm text-zinc-500">Create an agent first — workflows chain agents together.</p>;
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="steps" value={JSON.stringify(steps)} />
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <Label>Name</Label>
          <Input name="name" defaultValue={workflow?.name} placeholder="Research → Write → Review" required />
        </label>
        <label className="block">
          <Label hint="optional">Description</Label>
          <Input name="description" defaultValue={workflow?.description} />
        </label>
      </div>

      <fieldset className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <Label>Trigger</Label>
          <Select
            name="trigger_type"
            value={trigger}
            onChange={(e) => setTrigger(e.target.value as typeof trigger)}
          >
            <option value="manual">Manual (button or API)</option>
            <option value="webhook">Webhook (HTTP POST from another app)</option>
            <option value="schedule">Schedule (runs automatically)</option>
          </Select>
        </label>
        {trigger === "schedule" && (
          <label className="block">
            <Label>Every</Label>
            <Select name="schedule_interval" defaultValue={workflow?.schedule_interval ?? "daily"}>
              <option value="hourly">Hour</option>
              <option value="daily">Day</option>
              <option value="weekly">Week</option>
            </Select>
          </label>
        )}
      </fieldset>
      {trigger === "schedule" && (
        <label className="block">
          <Label hint="used as {{input}} for scheduled runs">Scheduled input</Label>
          <Textarea name="schedule_input" rows={2} defaultValue={workflow?.schedule_input} className="font-sans" />
        </label>
      )}

      <div>
        <Label hint="{{input}} = run input · {{previous}} = last agent's output · {{step1}}, {{step2}}… = a step's output">
          Steps
        </Label>
        <ol className="space-y-3">
          {steps.map((s, i) => (
            <li key={i} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                <span className="flex size-6 items-center justify-center rounded-full bg-zinc-100 text-xs dark:bg-zinc-800">
                  {i + 1}
                </span>
                {s.type === "agent" && <><Bot className="size-4 text-indigo-500" /> Agent</>}
                {s.type === "approval" && <><ShieldCheck className="size-4 text-amber-500" /> Human approval</>}
                {s.type === "condition" && <><Filter className="size-4 text-emerald-500" /> Condition</>}
                <span className="ml-auto flex gap-1">
                  <IconBtn label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="size-4" /></IconBtn>
                  <IconBtn label="Move down" disabled={i === steps.length - 1} onClick={() => move(i, 1)}><ArrowDown className="size-4" /></IconBtn>
                  <IconBtn label="Remove step" disabled={steps.length === 1} onClick={() => setSteps(steps.filter((_, j) => j !== i))}><Trash2 className="size-4" /></IconBtn>
                </span>
              </div>
              {s.type === "agent" && (
                <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
                  <Select value={s.agent_id} onChange={(e) => update(i, { agent_id: e.target.value })}>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </Select>
                  <Input
                    value={s.input}
                    onChange={(e) => update(i, { input: e.target.value })}
                    placeholder="{{previous}}"
                    aria-label="Step input template"
                  />
                </div>
              )}
              {s.type === "approval" && (
                <Input
                  value={s.message}
                  onChange={(e) => update(i, { message: e.target.value })}
                  placeholder="What should the reviewer check?"
                  aria-label="Approval message"
                />
              )}
              {s.type === "condition" && (
                <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
                  <Select value={s.mode} onChange={(e) => update(i, { mode: e.target.value as "contains" | "not_contains" })}>
                    <option value="contains">Continue only if output contains</option>
                    <option value="not_contains">Continue only if output does not contain</option>
                  </Select>
                  <Input value={s.value} onChange={(e) => update(i, { value: e.target.value })} placeholder="e.g. HOT" aria-label="Condition text" />
                </div>
              )}
            </li>
          ))}
        </ol>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => add("agent")}><Plus className="size-4" /> Agent step</Button>
          <Button type="button" variant="secondary" onClick={() => add("approval")}><Plus className="size-4" /> Approval</Button>
          <Button type="button" variant="secondary" onClick={() => add("condition")}><Plus className="size-4" /> Condition</Button>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="enabled" defaultChecked={workflow?.enabled ?? true} className="accent-indigo-600" />
        Enabled
      </label>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : submitLabel}</Button>
        {state.ok && !pending && <span className="text-sm text-emerald-600">Saved</span>}
      </div>
    </form>
  );
}

function IconBtn({ children, label, ...props }: React.ComponentProps<"button"> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="rounded p-1 text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-800"
      {...props}
    >
      {children}
    </button>
  );
}
