"use client";
import Link from "next/link";
import { useActionState } from "react";
import { MailCheck } from "lucide-react";
import { Button, Field, Input } from "@/components/ui";
import { requestPasswordReset, type AuthState } from "../actions";
import { ErrorBox, SentNotice } from "../login/login-form";

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(requestPasswordReset, {});
  if (state.message === "sent") {
    return <SentNotice icon={<MailCheck />} title="Check your email" text={<>If <b>{state.email}</b> has an account, you’ll get a link to reset your password.</>} />;
  }
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">Enter your email and we’ll send you a reset link.</p>
      <form action={action} className="mt-8 space-y-4" noValidate>
        <Field label="Email">
          <Input name="email" type="email" autoComplete="email" placeholder="you@company.com" required />
        </Field>
        {state.error && <ErrorBox>{state.error}</ErrorBox>}
        <Button type="submit" className="w-full" loading={pending}>Send reset link</Button>
      </form>
      <Link href="/login" className="mt-6 block text-center text-sm font-medium text-primary hover:underline">← Back to sign in</Link>
    </div>
  );
}
