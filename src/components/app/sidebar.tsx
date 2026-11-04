"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3, BookOpen, Bot, ChevronsLeft, ChevronsRight, History, LayoutDashboard, Plug, Settings, ShieldCheck, Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUI } from "@/stores/ui";
import { Tooltip } from "@/components/ui/misc";
import { Logo } from "./logo";

export const NAV = [
  { group: "Build", items: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/agents", label: "Agents", icon: Bot },
    { href: "/workflows", label: "Workflows", icon: Workflow },
    { href: "/knowledge", label: "Knowledge", icon: BookOpen },
    { href: "/integrations", label: "Integrations", icon: Plug },
  ] },
  { group: "Operate", items: [
    { href: "/approvals", label: "Approvals", icon: ShieldCheck, badgeKey: "approvals" as const },
    { href: "/runs", label: "Run history", icon: History },
    { href: "/analytics", label: "Analytics", icon: BarChart3 },
  ] },
  { group: "Workspace", items: [{ href: "/settings", label: "Settings", icon: Settings }] },
];

export function NavList({ collapsed, pendingApprovals, onNavigate }: { collapsed?: boolean; pendingApprovals?: number; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-5 px-3">
      {NAV.map((g) => (
        <div key={g.group}>
          {!collapsed && <p className="mb-1.5 px-2 text-[11px] font-medium tracking-wider text-muted-foreground/80 uppercase">{g.group}</p>}
          <ul className="space-y-0.5">
            {g.items.map(({ href, label, icon: Icon, ...rest }) => {
              const active = pathname === href || pathname.startsWith(href + "/") ||
                (href === "/approvals" && pathname.startsWith("/workflow-runs"));
              const badge = "badgeKey" in rest && pendingApprovals ? pendingApprovals : 0;
              const link = (
                <Link
                  href={href}
                  onClick={onNavigate}
                  className={cn(
                    "group relative flex h-9 items-center gap-3 rounded-md px-2.5 text-sm transition-colors",
                    active ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    collapsed && "justify-center px-0",
                  )}
                >
                  {active && <span className="absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full bg-primary" />}
                  <Icon className="size-4 shrink-0" />
                  {!collapsed && <span className="flex-1 truncate">{label}</span>}
                  {badge > 0 && (
                    <span className={cn("flex min-w-5 items-center justify-center rounded-full bg-warning px-1.5 text-[10px] font-semibold text-black", collapsed && "absolute -top-0.5 -right-0.5 min-w-4 px-1")}>
                      {badge}
                    </span>
                  )}
                </Link>
              );
              return <li key={href}>{collapsed ? <Tooltip content={label} side="right">{link}</Tooltip> : link}</li>;
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function Sidebar({ pendingApprovals, workspaceSwitcher, userMenu }: { pendingApprovals: number; workspaceSwitcher: React.ReactNode; userMenu: React.ReactNode }) {
  const { sidebarCollapsed: collapsed, toggleSidebar } = useUI();
  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col border-r bg-sidebar transition-[width] duration-200 md:flex",
        collapsed ? "w-[68px]" : "w-64",
      )}
    >
      <div className={cn("flex h-14 items-center border-b px-4", collapsed && "justify-center px-0")}>
        <Link href="/dashboard"><Logo collapsed={collapsed} /></Link>
      </div>
      {!collapsed && <div className="px-3 pt-3">{workspaceSwitcher}</div>}
      <div className="flex-1 overflow-y-auto py-4">
        <NavList collapsed={collapsed} pendingApprovals={pendingApprovals} />
      </div>
      <div className={cn("border-t p-3", collapsed && "px-2")}>
        {userMenu}
        <button
          onClick={toggleSidebar}
          className={cn("mt-2 flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground", collapsed && "justify-center px-0")}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronsRight className="size-4" /> : <><ChevronsLeft className="size-4" /> Collapse</>}
        </button>
      </div>
    </aside>
  );
}
