"use client";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const subscribe = () => () => {};

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const opts = [
    { v: "light", icon: Sun, label: "Light" },
    { v: "dark", icon: Moon, label: "Dark" },
    { v: "system", icon: Monitor, label: "System" },
  ];
  return (
    <div className={cn("inline-flex items-center rounded-lg border bg-card p-0.5", className)} role="radiogroup" aria-label="Theme">
      {opts.map(({ v, icon: Icon, label }) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={mounted && theme === v}
          aria-label={label}
          title={label}
          onClick={() => setTheme(v)}
          className={cn(
            "flex size-7 items-center justify-center rounded-md text-muted-foreground transition hover:text-foreground",
            mounted && theme === v && "bg-accent text-accent-foreground",
          )}
        >
          <Icon className="size-3.5" />
        </button>
      ))}
    </div>
  );
}
