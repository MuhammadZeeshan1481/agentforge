"use client";
import { useActionState } from "react";
import { Button, Field } from "@/components/ui";
import { updatePassword, type AuthState } from "../actions";
import { PasswordInput } from "../auth-ui";
import { ErrorBox } from "../login/login-form";

export default function ResetPasswordPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(updatePassword, {});
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">You’ll be signed in after saving it.</p>
      <form action={action} className="mt-8 space-y-4" noValidate>
        <Field label="New password">
          <PasswordInput name="password" autoComplete="new-password" showStrength required />
        </Field>
        <Field label="Confirm new password">
          <PasswordInput name="confirm" autoComplete="new-password" required />
        </Field>
        {state.error && <ErrorBox>{state.error}</ErrorBox>}
        <Button type="submit" className="w-full" loading={pending}>Update password</Button>
      </form>
    </div>
  );
}
