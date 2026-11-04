"use client";
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useStore } from "zustand";
import { toast } from "sonner";
import { Bot } from "lucide-react";
import { Button, Card, CardContent, EmptyState, Field, Input, NativeSelect, Textarea } from "@/components/ui";
import { Switch } from "@/components/ui/misc";
import type { WorkflowStep } from "@/lib/workflows";
import type { FormState } from "./actions";
import { WorkflowBuilder, useWorkflowBuilder } from "./workflow-builder";

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
  agents: { id: string; name: string }[];
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [trigger, setTrigger] = useState(workflow?.trigger_type ?? "manual");
  const [interval, setInterval] = useState(workflow?.schedule_interval ?? "daily");
  const [enabled, setEnabled] = useState(workflow?.enabled ?? true);
  const store = useWorkflowBuilder(workflow?.steps ?? [], agents[0]?.id ?? "");
  const steps = useStore(store, (s) => s.steps);

  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.ok) toast.success("Workflow saved");
  }, [state]);

  if (!agents.length) {
    return (
      <EmptyState
        icon={<Bot />}
        title="Create an agent first"
        description="Workflows chain agents together — you need at least one."
        action={<Button asChild><Link href="/agents/new">Create an agent</Link></Button>}
      />
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="steps" value={JSON.stringify(steps.map((s) => Object.fromEntries(Object.entries(s).filter(([k]) => k !== "uid"))))} />
      <input type="hidden" name="enabled" value={enabled ? "on" : ""} />
      <Card>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <Field label="Name"><Input name="name" defaultValue={workflow?.name} placeholder="Qualify lead → approve → reply" required /></Field>
          <Field label="Description" hint="optional"><Input name="description" defaultValue={workflow?.description} /></Field>
          <Field label="Trigger">
            <NativeSelect name="trigger_type" value={trigger} onChange={(e) => setTrigger(e.target.value as typeof trigger)}>
              <option value="manual">Manual — Run button or API</option>
              <option value="webhook">Webhook — HTTP POST from another app</option>
              <option value="schedule">Schedule — runs automatically</option>
            </NativeSelect>
          </Field>
          {trigger === "schedule" ? (
            <Field label="Repeat every">
              <NativeSelect name="schedule_interval" value={interval ?? "daily"} onChange={(e) => setInterval(e.target.value)}>
                <option value="hourly">Hour</option>
                <option value="daily">Day</option>
                <option value="weekly">Week</option>
              </NativeSelect>
            </Field>
          ) : (
            <div className="flex items-end">
              <label className="flex items-center gap-3 text-sm">
                <Switch checked={enabled} onCheckedChange={setEnabled} /> {enabled ? "Enabled" : "Disabled"}
              </label>
            </div>
          )}
          {trigger === "schedule" && (
            <>
              <Field label="Scheduled input" hint="becomes {{input}}" className="md:col-span-2">
                <Textarea name="schedule_input" rows={2} defaultValue={workflow?.schedule_input} placeholder="e.g. Summarize yesterday’s unread emails" />
              </Field>
              <label className="flex items-center gap-3 text-sm">
                <Switch checked={enabled} onCheckedChange={setEnabled} /> {enabled ? "Enabled" : "Disabled"}
              </label>
            </>
          )}
        </CardContent>
      </Card>

      <WorkflowBuilder store={store} agents={agents} trigger={{ type: trigger, interval }} />

      <div className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3">
        <span className="text-sm text-muted-foreground">{steps.length} step{steps.length === 1 ? "" : "s"}</span>
        <Button type="submit" loading={pending}>{submitLabel}</Button>
      </div>
    </form>
  );
}
