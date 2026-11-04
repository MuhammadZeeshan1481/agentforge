"use client";
import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button, Field, Input } from "@/components/ui";
import { PasswordInput } from "../../(auth)/auth-ui";
import { changeEmail, changePassword, deleteAccount, updateProfile, type State } from "./actions";

function useToast(state: State) {
  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.message) toast.success(state.message);
  }, [state]);
}

export function ProfileForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState<State, FormData>(updateProfile, {});
  useToast(state);
  return (
    <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <Field label="Full name" className="flex-1"><Input name="name" defaultValue={name} required /></Field>
      <Button type="submit" variant="outline" loading={pending}>Save</Button>
    </form>
  );
}

export function EmailForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState<State, FormData>(changeEmail, {});
  useToast(state);
  return (
    <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <Field label="Email address" className="flex-1"><Input name="email" type="email" defaultValue={email} required /></Field>
      <Button type="submit" variant="outline" loading={pending}>Change email</Button>
    </form>
  );
}

export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [state, action, pending] = useActionState<State, FormData>(changePassword, {});
  useToast(state);
  if (!hasPassword) {
    return <p className="text-sm text-muted-foreground">You sign in with Google or an email link. Use “Forgot password” on the sign-in page to add a password.</p>;
  }
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-3">
      <Field label="Current password"><PasswordInput name="current" autoComplete="current-password" required /></Field>
      <Field label="New password"><PasswordInput name="password" autoComplete="new-password" showStrength required /></Field>
      <Field label="Confirm new password"><PasswordInput name="confirm" autoComplete="new-password" required /></Field>
      <div className="sm:col-span-3"><Button type="submit" variant="outline" loading={pending}>Update password</Button></div>
    </form>
  );
}

export function DeleteAccountForm() {
  const [state, action, pending] = useActionState<State, FormData>(deleteAccount, {});
  useToast(state);
  return (
    <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <Field label={<>Type <code className="rounded bg-muted px-1">DELETE</code> to confirm</>} className="flex-1">
        <Input name="confirm" autoComplete="off" placeholder="DELETE" />
      </Field>
      <Button type="submit" variant="destructive" loading={pending}>Delete my account</Button>
    </form>
  );
}
