"use client";
import { useActionState, useState } from "react";
import { Button, Input, Label, Select, Textarea } from "@/components/ui";
import { DEFAULT_MODEL, MODELS, TOOL_CATALOG, TOOL_IDS } from "@/lib/tools/catalog";
import type { Agent } from "@/lib/types";
import type { FormState } from "./actions";

export function AgentForm({
  agent,
  action,
  submitLabel,
}: {
  agent?: Agent;
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [tools, setTools] = useState<string[]>(agent?.tools ?? ["web_fetch"]);

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <Label>Name</Label>
          <Input name="name" defaultValue={agent?.name} placeholder="Research assistant" required />
        </label>
        <label className="block">
          <Label>Model</Label>
          <Select name="model" defaultValue={agent?.model ?? DEFAULT_MODEL}>
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </Select>
        </label>
      </div>

      <label className="block">
        <Label hint="optional">Description</Label>
        <Input
          name="description"
          defaultValue={agent?.description}
          placeholder="What this agent is for"
        />
      </label>

      <label className="block">
        <Label hint="the agent's role and rules">Instructions</Label>
        <Textarea
          name="instructions"
          rows={8}
          defaultValue={agent?.instructions}
          placeholder={"You are a research assistant. Given a topic, fetch 2-3 relevant pages and write a short summary with sources."}
        />
      </label>

      <fieldset>
        <Label>Tools</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {TOOL_IDS.map((id) => (
            <label
              key={id}
              className="flex cursor-pointer gap-3 rounded-md border border-zinc-200 p-3 has-checked:border-indigo-500 has-checked:bg-indigo-50/50 dark:border-zinc-800 dark:has-checked:bg-indigo-950/30"
            >
              <input
                type="checkbox"
                name="tools"
                value={id}
                checked={tools.includes(id)}
                onChange={(e) =>
                  setTools(e.target.checked ? [...tools, id] : tools.filter((t) => t !== id))
                }
                className="mt-0.5 accent-indigo-600"
              />
              <span>
                <span className="block text-sm font-medium">{TOOL_CATALOG[id].label}</span>
                <span className="block text-xs text-zinc-500">{TOOL_CATALOG[id].description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {tools.includes("slack_post") && (
        <label className="block">
          <Label hint="visible to workspace members">Slack incoming webhook URL</Label>
          <Input
            name="slack_webhook_url"
            type="url"
            defaultValue={agent?.tool_config?.slack_post?.webhook_url ?? ""}
            placeholder="https://hooks.slack.com/services/…"
          />
        </label>
      )}

      <label className="block max-w-40">
        <Label hint="1–25">Max steps</Label>
        <Input name="max_steps" type="number" min={1} max={25} defaultValue={agent?.max_steps ?? 8} />
      </label>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        {state.ok && !pending && (
          <span className="text-sm text-emerald-600">Saved</span>
        )}
      </div>
    </form>
  );
}
