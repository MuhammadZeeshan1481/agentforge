"use client";
import { useActionState, useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, Field, Input } from "@/components/ui";
import { AGENT_TEMPLATES } from "@/lib/templates";
import { completeOnboarding, type State } from "./actions";

export function OnboardingForm({ name, workspace, isOwner }: { name: string; workspace: string; isOwner: boolean }) {
  const [state, action, pending] = useActionState<State, FormData>(completeOnboarding, {});
  const [template, setTemplate] = useState<string>("web-researcher");
  return (
    <form action={action} className="space-y-8">
      <input type="hidden" name="template" value={template} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name"><Input name="name" defaultValue={name} required /></Field>
        <Field label="Workspace name" hint={isOwner ? undefined : "set by the owner"}>
          <Input name="workspace" defaultValue={workspace} readOnly={!isOwner} required />
        </Field>
      </div>
      <div>
        <p className="mb-1 text-sm font-medium">Start with an agent</p>
        <p className="mb-3 text-sm text-muted-foreground">Pick a template — you can change everything later.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {AGENT_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTemplate(t.id)}
              className={cn(
                "relative rounded-xl border bg-card p-4 text-left transition hover:border-primary/50",
                template === t.id && "border-primary ring-2 ring-primary/20",
              )}
            >
              {template === t.id && <Check className="absolute top-3 right-3 size-4 text-primary" />}
              <p className="text-sm font-medium">{t.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setTemplate("")}
            className={cn("rounded-xl border border-dashed p-4 text-left text-sm transition hover:border-primary/50", template === "" && "border-primary ring-2 ring-primary/20")}
          >
            <p className="font-medium">Skip for now</p>
            <p className="mt-1 text-xs text-muted-foreground">Go straight to the dashboard.</p>
          </button>
        </div>
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" size="lg" className="w-full sm:w-auto" loading={pending}>
        Continue <ArrowRight />
      </Button>
    </form>
  );
}
