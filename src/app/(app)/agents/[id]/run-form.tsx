"use client";
import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Play } from "lucide-react";
import { Button, Textarea } from "@/components/ui";
import type { FormState } from "../actions";

export function RunForm({
  action,
  placeholder = "What should the agent do? e.g. Summarize https://news.ycombinator.com",
  defaultValue,
  label = "Run",
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  placeholder?: string;
  defaultValue?: string;
  label?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);
  return (
    <form action={formAction} className="space-y-3">
      <Textarea
        name="input"
        rows={3}
        defaultValue={defaultValue}
        placeholder={placeholder}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit();
        }}
      />
      <div className="flex items-center justify-between gap-3">
        <span className="hidden text-xs text-muted-foreground sm:inline">⌘/Ctrl + Enter to run</span>
        <Button type="submit" loading={pending}>{!pending && <Play />} {label}</Button>
      </div>
    </form>
  );
}
