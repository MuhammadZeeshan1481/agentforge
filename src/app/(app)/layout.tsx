import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/workspace";
import { Sidebar } from "@/components/app/sidebar";
import { MobileNav, UserMenu, WorkspaceSwitcher } from "@/components/app/menus";
import { SidebarUserMenu } from "@/components/app/collapsible-user";
import { PageSkeleton } from "@/components/page-skeleton";
import { switchWorkspace } from "./settings/actions";

async function Shell({ children }: { children: React.ReactNode }) {
  const { supabase, user, workspace, workspaces, role, profile } = await getContext();
  // Read onboarding state fresh (not from the per-request cached context): the
  // onboarding action updates it and then redirects within the same request.
  const { data: fresh } = await supabase.from("profiles").select("onboarded").eq("id", user.id).maybeSingle();
  if (fresh && !fresh.onboarded) redirect("/onboarding");
  const { count } = await supabase
    .from("workflow_runs")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspace.id)
    .eq("status", "waiting_approval");

  const current = { id: workspace.id, name: workspace.name, role };
  const switcher = <WorkspaceSwitcher current={current} workspaces={workspaces} onSwitch={switchWorkspace} />;
  const email = user.email ?? "";

  return (
    <div className="flex min-h-screen">
      <Sidebar
        pendingApprovals={count ?? 0}
        workspaceSwitcher={switcher}
        userMenu={<SidebarUserMenu name={profile.fullName} email={email} />}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav pendingApprovals={count ?? 0} workspaceSwitcher={switcher} userMenu={<UserMenu name={profile.fullName} email={email} />} />
        <main className="flex-1 px-4 py-6 sm:px-6 md:px-10 md:py-10">
          <div className="mx-auto max-w-6xl">
            <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}

function ShellSkeleton() {
  return (
    <div className="flex min-h-screen">
      <div className="hidden w-64 border-r bg-sidebar md:block" />
      <div className="flex-1 px-10 py-10"><PageSkeleton /></div>
    </div>
  );
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}
