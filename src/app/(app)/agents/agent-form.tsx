"use client";
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertCircle, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, Field, Input, NativeSelect, Textarea } from "@/components/ui";
import { DEFAULT_MODEL, MODELS, TOOL_CATALOG, TOOL_CATEGORIES, TOOL_IDS, type ToolId } from "@/lib/tools/catalog";
import type { Agent } from "@/lib/types";
import type { FormState } from "./actions";

export function AgentForm({
  agent,
  action,
  submitLabel,
  connected = [],
  emailReady = false,
}: {
  agent?: Partial<Agent>;
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  connected?: string[];
  emailReady?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [tools, setTools] = useState<string[]>(agent?.tools ?? ["web_fetch"]);
  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.ok) toast.success("Agent saved");
  }, [state]);

  const warn = (id: ToolId): string | null => {
    const meta = TOOL_CATALOG[id] as { provider?: string };
    if (meta.provider && !connected.includes(meta.provider)) return `Connect ${meta.provider === "google" ? "Google" : "Notion"} on the Integrations page`;
    if (id === "send_email" && !emailReady) return "Email isn't configured (RESEND_API_KEY)";
    return null;
  };

  return (
    <form action={formAction} className="space-y-8">
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Name"><Input name="name" defaultValue={agent?.name} placeholder="Research assistant" required /></Field>
        <Field label="Model">
          <NativeSelect name="model" defaultValue={agent?.model ?? DEFAULT_MODEL}>
            {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label} — {m.hint}</option>)}
          </NativeSelect>
        </Field>
      </div>
      <Field label="Description" hint="optional">
        <Input name="description" defaultValue={agent?.description} placeholder="What this agent is for" />
      </Field>
      <Field label="Instructions" hint="the agent's role, rules and output format">
        <Textarea
          name="instructions"
          rows={9}
          defaultValue={agent?.instructions}
          className="font-mono text-[13px] leading-relaxed"
          placeholder="You are a research assistant. Given a topic, fetch 2–3 relevant pages and write a short summary with sources."
        />
      </Field>

      <fieldset>
        <legend className="mb-1 text-sm font-medium">Tools</legend>
        <p className="mb-4 text-sm text-muted-foreground">{tools.length} selected · the agent decides when to call them.</p>
        <div className="space-y-5">
          {TOOL_CATEGORIES.map((cat) => {
            const ids = TOOL_IDS.filter((id) => TOOL_CATALOG[id].category === cat);
            return (
              <div key={cat}>
                <p className="mb-2 text-xs font-medium tracking-wider text-muted-foreground uppercase">{cat}</p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {ids.map((id) => {
                    const on = tools.includes(id);
                    const w = warn(id);
                    return (
                      <label
                        key={id}
                        className={cn(
                          "relative flex cursor-pointer gap-3 rounded-lg border bg-card p-3 transition hover:border-primary/40",
                          on && "border-primary/60 bg-primary/[0.04] ring-1 ring-primary/20",
                        )}
                      >
                        <input
                          type="checkbox"
                          name="tools"
                          value={id}
                          checked={on}
                          onChange={(e) => setTools(e.target.checked ? [...tools, id] : tools.filter((t) => t !== id))}
                          className="sr-only"
                        />
                        <span className={cn("mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border", on ? "border-primary bg-primary text-primary-foreground" : "border-input")}>
                          {on && <Check className="size-3" />}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">{TOOL_CATALOG[id].label}</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">{TOOL_CATALOG[id].description}</span>
                          {on && w && (
                            <span className="mt-1.5 flex items-center gap-1 text-xs text-[color:var(--warning)]">
                              <AlertCircle className="size-3" /> {w.includes("Integrations") ? <Link href="/integrations" className="underline">{w}</Link> : w}
                            </span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </fieldset>

      {tools.includes("slack_post") && (
        <Field label="Slack incoming webhook URL" hint="visible to workspace members">
          <Input name="slack_webhook_url" type="url" defaultValue={agent?.tool_config?.slack_post?.webhook_url ?? ""} placeholder="https://hooks.slack.com/services/…" />
        </Field>
      )}

      <Field label="Max steps" hint="1–25 model/tool steps per run" className="max-w-48">
        <Input name="max_steps" type="number" min={1} max={25} defaultValue={agent?.max_steps ?? 8} />
      </Field>

      <div className="flex items-center gap-3 border-t pt-6">
        <Button type="submit" loading={pending}>{submitLabel}</Button>
      </div>
    </form>
  );
}
