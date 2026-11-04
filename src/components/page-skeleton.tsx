export function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 w-48 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-32 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
    </div>
  );
}
