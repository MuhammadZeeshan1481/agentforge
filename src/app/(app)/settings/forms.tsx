"use client";
import { useActionState, useState } from "react";
import { Copy } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { createApiKey, renameWorkspace, type FormState, type KeyState } from "./actions";

export function RenameForm({ name, disabled }: { name: string; disabled: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(renameWorkspace, {});
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <Input name="name" defaultValue={name} disabled={disabled} className="max-w-xs" aria-label="Workspace name" />
      <Button type="submit" variant="secondary" disabled={pending || disabled}>Rename</Button>
      {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      {state.ok && <span className="text-sm text-emerald-600">Saved</span>}
    </form>
  );
}

export function ApiKeyForm() {
  const [state, action, pending] = useActionState<KeyState, FormData>(createApiKey, {});
  return (
    <div className="space-y-3">
      <form action={action} className="flex flex-wrap gap-2">
        <Input name="name" placeholder="Key name, e.g. Zapier" className="max-w-xs" required aria-label="API key name" />
        <Button type="submit" disabled={pending}>Create key</Button>
      </form>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.key && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/30">
          <p className="font-medium">Copy this key now — it won’t be shown again.</p>
          <CopyField value={state.key} />
        </div>
      )}
    </div>
  );
}

export function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-2 flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded bg-white px-2 py-1 text-xs dark:bg-zinc-900">{value}</code>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600"
      >
        <Copy className="size-3.5" /> {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
