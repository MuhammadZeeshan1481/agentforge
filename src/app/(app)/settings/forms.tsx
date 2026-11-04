"use client";
import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Copy, KeyRound, Mail, Trash2 } from "lucide-react";
import { Button, Field, Input, NativeSelect } from "@/components/ui";
import { ConfirmDialog } from "@/components/ui/dialog";
import { createApiKey, createInvite, renameWorkspace, revokeApiKey, deleteInvite, removeMember, type FormState, type KeyState } from "./actions";

function useToast(state: { error?: string; ok?: boolean; message?: string }, ok?: string) {
  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.ok) toast.success(state.message ?? ok ?? "Saved");
  }, [state, ok]);
}

export function RenameForm({ name, disabled }: { name: string; disabled: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(renameWorkspace, {});
  useToast(state, "Workspace renamed");
  return (
    <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <Field label="Workspace name" hint={disabled ? "only the owner can rename" : undefined} className="flex-1">
        <Input name="name" defaultValue={name} disabled={disabled} />
      </Field>
      <Button type="submit" variant="outline" disabled={disabled} loading={pending}>Save</Button>
    </form>
  );
}

export function InviteForm() {
  const [state, action, pending] = useActionState<FormState & { message?: string }, FormData>(createInvite, {});
  useToast(state);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[1fr_160px_auto] sm:items-end">
      <Field label="Email" hint="optional — leave empty for a shareable link"><Input name="email" type="email" placeholder="teammate@company.com" /></Field>
      <Field label="Role">
        <NativeSelect name="role" defaultValue="editor">
          <option value="admin">Admin</option>
          <option value="editor">Editor</option>
          <option value="viewer">Viewer</option>
        </NativeSelect>
      </Field>
      <Button type="submit" loading={pending}>{!pending && <Mail />} Invite</Button>
    </form>
  );
}

export function ApiKeyForm() {
  const [state, action, pending] = useActionState<KeyState, FormData>(createApiKey, {});
  useEffect(() => { if (state.error) toast.error(state.error); }, [state]);
  return (
    <div className="space-y-3">
      <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field label="Key name" className="flex-1"><Input name="name" placeholder="e.g. Zapier, backend" required /></Field>
        <Button type="submit" loading={pending}>{!pending && <KeyRound />} Create key</Button>
      </form>
      {state.key && (
        <div className="rounded-lg border border-warning/40 bg-warning/[0.06] p-4 text-sm">
          <p className="font-medium">Copy your new key now — you won’t see it again.</p>
          <CopyField value={state.key} />
        </div>
      )}
    </div>
  );
}

export function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-2 flex items-center gap-2 rounded-md border bg-card p-1.5">
      <code className="min-w-0 flex-1 truncate px-1.5 text-xs">{value}</code>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          toast.success("Copied to clipboard");
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        <Copy /> {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

export function DangerButton({ label, title, description, onConfirm, icon = true }: { label: string; title: string; description: string; onConfirm: () => Promise<void>; icon?: boolean }) {
  const [pending, start] = useTransition();
  return (
    <ConfirmDialog
      title={title}
      description={description}
      destructive
      confirmLabel={label}
      onConfirm={() => start(() => onConfirm())}
      trigger={<Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" loading={pending}>{icon && !pending && <Trash2 />}{label}</Button>}
    />
  );
}

export const actions = { revokeApiKey, deleteInvite, removeMember };
