"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState, useTransition } from "react";
import { toast } from "sonner";
import { MailCheck } from "lucide-react";
import { Button, Field, Input } from "@/components/ui";
import { resendConfirmation, signInWithGoogle, signUp, type AuthState } from "../actions";
import { Divider, GoogleIcon, PasswordInput } from "../auth-ui";
import { ErrorBox, SentNotice } from "../login/login-form";

const googleEnabled = process.env.NEXT_PUBLIC_AUTH_GOOGLE === "true";

export function SignupForm() {
  const next = useSearchParams().get("next") ?? "";
  const [state, action, pending] = useActionState<AuthState, FormData>(signUp, {});
  const [resending, startResend] = useTransition();

  if (state.message === "sent") {
    return (
      <SentNotice icon={<MailCheck />} title="Confirm your email" text={<>We sent a confirmation link to <b>{state.email}</b>. Click it to activate your account.</>}>
        <Button
          variant="outline"
          className="mt-6"
          loading={resending}
          onClick={() =>
            startResend(async () => {
              const r = await resendConfirmation(state.email ?? "");
              if (r.error) toast.error(r.error);
              else toast.success(r.message);
            })
          }
        >
          Resend email
        </Button>
        <p className="mt-3 text-xs text-muted-foreground">Can’t find it? Check spam, or wait a minute before resending.</p>
      </SentNotice>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Already have one? <Link href="/login" className="font-medium text-primary hover:underline">Sign in</Link>
      </p>

      {googleEnabled && (
        <>
          <form action={signInWithGoogle} className="mt-8">
            <input type="hidden" name="next" value={next || "/onboarding"} />
            <Button type="submit" variant="outline" className="w-full"><GoogleIcon /> Sign up with Google</Button>
          </form>
          <Divider>or with email</Divider>
        </>
      )}

      <form action={action} className={googleEnabled ? "space-y-4" : "mt-8 space-y-4"} noValidate>
        <Field label="Full name">
          <Input name="name" autoComplete="name" placeholder="Ayesha Khan" required />
        </Field>
        <Field label="Work email">
          <Input name="email" type="email" autoComplete="email" placeholder="you@company.com" defaultValue={state.email} required />
        </Field>
        <Field label="Password">
          <PasswordInput name="password" autoComplete="new-password" showStrength required />
        </Field>
        {state.error && <ErrorBox>{state.error}</ErrorBox>}
        <Button type="submit" className="w-full" loading={pending}>Create account</Button>
        <p className="text-center text-xs text-muted-foreground">By creating an account you agree to use AgentForge responsibly.</p>
      </form>
    </div>
  );
}
