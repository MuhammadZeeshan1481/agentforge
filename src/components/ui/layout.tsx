import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  back,
  icon,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
  icon?: React.ReactNode;
}) {
  return (
    <div className="mb-8">
      {back && (
        <Link href={back.href} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          ← {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          {icon && <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-card text-primary shadow-xs">{icon}</div>}
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
            {description && <div className="mt-1 text-sm text-muted-foreground">{description}</div>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-xl border border-dashed bg-card/50 px-6 py-14 text-center", className)}>
      {icon && <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary [&_svg]:size-6">{icon}</div>}
      <p className="font-medium">{title}</p>
      {description && <div className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Section({ title, description, actions, children, className }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("mt-10", className)}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function StatCard({ label, value, icon, hint }: { label: string; value: React.ReactNode; icon?: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-xs">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        {label}
        {icon && <span className="text-muted-foreground/70 [&_svg]:size-4">{icon}</span>}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />;
}

export function DataTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm [&_tbody_tr]:border-t [&_tbody_tr:hover]:bg-muted/40 [&_td]:px-4 [&_td]:py-3 [&_th]:px-4 [&_th]:py-2.5 [&_th]:text-xs [&_th]:font-medium [&_th]:text-muted-foreground [&_thead]:bg-muted/40">
          {children}
        </table>
      </div>
    </div>
  );
}
