import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap [&_svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary/10 text-primary",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "text-foreground",
        success: "border-transparent bg-success/12 text-success",
        warning: "border-transparent bg-warning/15 text-[color:var(--warning)]",
        destructive: "border-transparent bg-destructive/12 text-destructive",
        info: "border-transparent bg-sky-500/12 text-sky-600 dark:text-sky-400",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

const statusVariant: Record<string, VariantProps<typeof badgeVariants>["variant"]> = {
  queued: "secondary",
  running: "info",
  waiting_approval: "warning",
  succeeded: "success",
  failed: "destructive",
};
const statusLabel: Record<string, string> = { waiting_approval: "needs approval" };

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={statusVariant[status] ?? "secondary"}>
      {(status === "running" || status === "queued") && <span className="size-1.5 animate-pulse rounded-full bg-current" />}
      {statusLabel[status] ?? status}
    </Badge>
  );
}
