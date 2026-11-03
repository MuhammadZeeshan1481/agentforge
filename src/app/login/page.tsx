import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

async function LoginContent({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const { next, error } = await searchParams;
  return (
    <>
      {error && <p className="mb-4 text-sm text-red-600">Sign-in link was invalid or expired.</p>}
      <LoginForm next={typeof next === "string" ? next : undefined} />
    </>
  );
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 block text-center text-xl font-semibold">
          ⚒️ AgentForge
        </Link>
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <Suspense>
            <LoginContent searchParams={searchParams} />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
