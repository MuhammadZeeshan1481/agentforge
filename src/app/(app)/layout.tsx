import Link from "next/link";
import { Suspense } from "react";
import { getContext } from "@/lib/workspace";
import { NavLinks } from "./nav-links";

async function WorkspaceName() {
  const { workspace } = await getContext();
  return <>{workspace.name}</>;
}

async function UserFooter() {
  const { user } = await getContext();
  return (
    <>
      <p className="truncate text-xs text-zinc-500">{user.email}</p>
      <form action="/auth/signout" method="post" className="mt-2">
        <button className="text-xs font-medium text-zinc-600 hover:underline dark:text-zinc-400">
          Sign out
        </button>
      </form>
    </>
  );
}

function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 w-48 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-32 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
    </div>
  );
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b border-zinc-200 bg-white md:w-60 md:shrink-0 md:border-r md:border-b-0 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between gap-2 p-4 md:block">
          <Link href="/dashboard" className="text-lg font-semibold">
            ⚒️ AgentForge
          </Link>
          <p className="truncate text-xs text-zinc-500 md:mt-1">
            <Suspense fallback="…">
              <WorkspaceName />
            </Suspense>
          </p>
        </div>
        <Suspense>
          <NavLinks />
        </Suspense>
        <div className="hidden border-t border-zinc-200 p-4 md:block dark:border-zinc-800">
          <Suspense>
            <UserFooter />
          </Suspense>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto max-w-5xl">
          <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
        </div>
      </main>
    </div>
  );
}
