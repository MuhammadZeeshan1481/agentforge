"use client";
import { useActionState, useState } from "react";
import { signIn, signUp, type AuthState } from "./actions";
import { Button, Input, Label } from "@/components/ui";

export function LoginForm({ next }: { next?: string }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [state, action, pending] = useActionState<AuthState, FormData>(
    mode === "signin" ? signIn : signUp,
    {},
  );

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <label className="block">
        <Label>Email</Label>
        <Input name="email" type="email" autoComplete="email" required />
      </label>
      <label className="block">
        <Label>Password</Label>
        <Input
          name="password"
          type="password"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          minLength={8}
          required
        />
      </label>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.message && <p className="text-sm text-emerald-600">{state.message}</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
      </Button>
      <p className="text-center text-sm text-zinc-500">
        {mode === "signin" ? "No account yet?" : "Already have an account?"}{" "}
        <button
          type="button"
          className="font-medium text-indigo-600 hover:underline"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        >
          {mode === "signin" ? "Sign up" : "Sign in"}
        </button>
      </p>
    </form>
  );
}
