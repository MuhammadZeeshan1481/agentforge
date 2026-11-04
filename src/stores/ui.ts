"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

type UIState = {
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  toggleSidebar: () => void;
  setMobileNav: (open: boolean) => void;
};

/** App-shell UI state. The collapsed sidebar preference survives reloads. */
export const useUI = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      mobileNavOpen: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setMobileNav: (open) => set({ mobileNavOpen: open }),
    }),
    { name: "agentforge-ui", partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed }) },
  ),
);
