"use client";
import { useUI } from "@/stores/ui";
import { UserMenu } from "./menus";

export function SidebarUserMenu(props: { name: string; email: string }) {
  const collapsed = useUI((s) => s.sidebarCollapsed);
  return <UserMenu {...props} collapsed={collapsed} />;
}
