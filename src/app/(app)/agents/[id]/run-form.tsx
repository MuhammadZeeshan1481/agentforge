"use client";
import { useActionState } from "react";
import { Play } from "lucide-react";
import { Button, Textarea } from "@/components/ui";
import type { FormState } from "../actions";

export function RunForm({
  action,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-3">
      <Textarea
        name="input"
        rows={3}
        placeholder="What should the agent do? e.g. Summarize https://news.ycombinator.com"
        className="font-sans"
      />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        <Play className="size-4" />
        {pending ? "Starting…" : "Run"}
      </Button>
    </form>
  );
}
