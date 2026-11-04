"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import { KeyRound, Mail, MailCheck } from "lucide-react";
import { Button, Field, Input } from "@/components/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/misc";
import { resendConfirmation, sendMagicLink, signIn, signInWithGoogle, type AuthState } from "../actions";
import { Divider, GoogleIcon, PasswordInput } from "../auth-ui";

const googleEnabled = process.env.NEXT_PUBLIC_AUTH_GOOGLE === "true";

export function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "";
  const urlError = params.get("error");
  const [state, action, pending] = useActionState<AuthState, FormData>(signIn, {});
  const [magic, magicAction, magicPending] = useActionState<AuthState, FormData>(sendMagicLink, {});
  const [resending, startResend] = useTransition();
  const [email, setEmail] = useState("");

  if (magic.message === "sent") {
    return (
      <SentNotice
        icon={<MailCheck />}
        title="Check your inbox"
        text={<>If an account exists for <b>{magic.email}</b>, we sent a sign-in link. It expires in 1 hour.</>}
      />
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        New to AgentForge?{" "}
        <Link href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-primary hover:underline">Create an account</Link>
      </p>

      {urlError && <ErrorBox>{urlError === "callback" ? "That link is invalid or has expired. Please try again." : urlError}</ErrorBox>}

      {googleEnabled && (
        <>
          <form action={signInWithGoogle} className="mt-8">
            <input type="hidden" name="next" value={next} />
            <Button type="submit" variant="outline" className="w-full"><GoogleIcon /> Continue with Google</Button>
          </form>
          <Divider>or</Divider>
        </>
      )}

      <Tabs defaultValue="password" className={googleEnabled ? "" : "mt-8"}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="password"><KeyRound className="size-3.5" /> Password</TabsTrigger>
          <TabsTrigger value="magic"><Mail className="size-3.5" /> Email link</TabsTrigger>
        </TabsList>

        <TabsContent value="password">
          <form action={action} className="space-y-4" noValidate>
            <input type="hidden" name="next" value={next} />
            <Field label="Email">
              <Input name="email" type="email" autoComplete="email" placeholder="you@company.com" defaultValue={state.email} onChange={(e) => setEmail(e.target.value)} required />
            </Field>
            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <label htmlFor="password" className="text-sm font-medium">Password</label>
                <Link href="/forgot-password" className="text-xs font-medium text-primary hover:underline">Forgot password?</Link>
              </div>
              <PasswordInput id="password" name="password" autoComplete="current-password" required />
            </div>
            {state.error && (
              <ErrorBox>
                {state.error}
                {state.needsConfirmation && (
                  <button
                    type="button"
                    className="ml-1 font-medium underline"
                    disabled={resending}
                    onClick={() =>
                      startResend(async () => {
                        const r = await resendConfirmation(email || state.email || "");
                        if (r.error) toast.error(r.error);
                        else toast.success(r.message);
                      })
                    }
                  >
                    Resend confirmation email
                  </button>
                )}
              </ErrorBox>
            )}
            <Button type="submit" className="w-full" loading={pending}>Sign in</Button>
          </form>
        </TabsContent>

        <TabsContent value="magic">
          <form action={magicAction} className="space-y-4" noValidate>
            <input type="hidden" name="next" value={next} />
            <Field label="Email">
              <Input name="email" type="email" autoComplete="email" placeholder="you@company.com" required />
            </Field>
            {magic.error && <ErrorBox>{magic.error}</ErrorBox>}
            <Button type="submit" className="w-full" loading={magicPending}>Email me a sign-in link</Button>
            <p className="text-center text-xs text-muted-foreground">No password needed — we’ll email you a one-time link.</p>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function ErrorBox({ children }: { children: React.ReactNode }) {
  return <div role="alert" className="mt-4 rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2.5 text-sm text-destructive">{children}</div>;
}

export function SentNotice({ icon, title, text, children }: { icon: React.ReactNode; title: string; text: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary [&_svg]:size-6">{icon}</div>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{text}</p>
      {children}
      <Link href="/login" className="mt-8 inline-block text-sm font-medium text-primary hover:underline">← Back to sign in</Link>
    </div>
  );
}
