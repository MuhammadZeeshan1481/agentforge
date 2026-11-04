"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Check, ChevronsUpDown, LogOut, Menu, Plus, Settings, UserRound } from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { useUI } from "@/stores/ui";
import { Avatar, AvatarFallback } from "@/components/ui/misc";
import { Dialog, DialogContent, DialogTitle, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dialog";
import { ThemeToggle } from "./theme-toggle";
import { Logo } from "./logo";
import { NavList } from "./sidebar";

type Ws = { id: string; name: string; role: string };

export function WorkspaceSwitcher({ current, workspaces, onSwitch }: { current: Ws; workspaces: Ws[]; onSwitch: (id: string) => Promise<void> }) {
  const [pending, start] = useTransition();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-lg border bg-card px-2.5 py-2 text-left shadow-xs transition hover:bg-muted/60 disabled:opacity-60" disabled={pending}>
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">{initials(current.name)}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{current.name}</span>
          <span className="block text-[11px] text-muted-foreground capitalize">{current.role}</span>
        </span>
        <ChevronsUpDown className="size-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        {workspaces.map((w) => (
          <DropdownMenuItem key={w.id} onSelect={() => w.id !== current.id && start(() => onSwitch(w.id))}>
            <span className="flex size-6 items-center justify-center rounded bg-muted text-[10px] font-semibold">{initials(w.name)}</span>
            <span className="flex-1 truncate">{w.name}</span>
            {w.id === current.id && <Check className="!text-primary" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings#members"><Plus /> Invite teammates</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function UserMenu({ name, email, collapsed }: { name: string; email: string; collapsed?: boolean }) {
  const router = useRouter();
  const signOut = async () => {
    await fetch("/auth/signout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn("flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition hover:bg-muted", collapsed && "justify-center")}>
        <Avatar><AvatarFallback>{initials(name || email)}</AvatarFallback></Avatar>
        {!collapsed && (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{name}</span>
            <span className="block truncate text-xs text-muted-foreground">{email}</span>
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={collapsed ? "start" : "end"} side="top" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate text-sm font-medium text-foreground">{name}</span>
          <span className="block truncate">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild><Link href="/account"><UserRound /> Account</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link href="/settings"><Settings /> Workspace settings</Link></DropdownMenuItem>
        <DropdownMenuSeparator />
        <div className="flex items-center justify-between px-2 py-1.5 text-sm">
          Theme <ThemeToggle />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onSelect={signOut}><LogOut /> Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function MobileNav({ pendingApprovals, workspaceSwitcher, userMenu }: { pendingApprovals: number; workspaceSwitcher: React.ReactNode; userMenu: React.ReactNode }) {
  const { mobileNavOpen, setMobileNav } = useUI();
  return (
    <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-background/80 px-4 backdrop-blur md:hidden">
      <Link href="/dashboard"><Logo /></Link>
      <Dialog open={mobileNavOpen} onOpenChange={setMobileNav}>
        <button onClick={() => setMobileNav(true)} className="flex size-9 items-center justify-center rounded-md border bg-card" aria-label="Open menu">
          <Menu className="size-4" />
        </button>
        <DialogContent side="left" className="flex flex-col p-0" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Navigation</DialogTitle>
          <div className="flex h-14 items-center border-b px-4"><Logo /></div>
          <div className="px-3 pt-3">{workspaceSwitcher}</div>
          <div className="flex-1 overflow-y-auto py-4">
            <NavList pendingApprovals={pendingApprovals} onNavigate={() => setMobileNav(false)} />
          </div>
          <div className="border-t p-3">{userMenu}</div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
