"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { Brain, History, RotateCcw, X } from "lucide-react";
import { Button, EmptyState } from "@/components/ui";
import { ConfirmDialog } from "@/components/ui/dialog";
import { LocalTime } from "@/components/local-time";
import { clearMemories, deleteMemory, restoreAgentVersion } from "../actions";

export function MemoryPanel({ agentId, memories, enabled }: { agentId: string; memories: { id: number; content: string; created_at: string }[]; enabled: boolean }) {
  const [pending, start] = useTransition();
  if (!enabled) {
    return <EmptyState icon={<Brain />} title="Memory is off" description="Enable the “Long-term memory” tool in Configuration to let this agent remember facts across runs." />;
  }
  if (!memories.length) {
    return <EmptyState icon={<Brain />} title="Nothing remembered yet" description="The agent saves durable facts with its save_memory tool while it runs." />;
  }
  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <p className="text-sm font-medium">{memories.length} memories</p>
        <ConfirmDialog
          title="Clear all memories?"
          description="The agent will forget everything it saved."
          destructive
          confirmLabel="Clear"
          onConfirm={() => start(async () => { await clearMemories(agentId); toast.success("Memories cleared"); })}
          trigger={<Button size="sm" variant="ghost" className="text-destructive" loading={pending}>Clear all</Button>}
        />
      </div>
      <ul className="divide-y">
        {memories.map((m) => (
          <li key={m.id} className="group flex items-start gap-3 px-4 py-3 text-sm">
            <Brain className="mt-0.5 size-4 shrink-0 text-primary" />
            <span className="flex-1">{m.content}<span className="ml-2 text-xs text-muted-foreground"><LocalTime iso={m.created_at} format="short" /></span></span>
            <button onClick={() => start(() => deleteMemory(agentId, m.id))} className="opacity-0 transition group-hover:opacity-100" aria-label="Forget this memory">
              <X className="size-4 text-muted-foreground hover:text-destructive" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function VersionsPanel({ agentId, versions }: { agentId: string; versions: { id: number; version: number; created_at: string; snapshot: { name?: string; model?: string; instructions?: string } }[] }) {
  const [pending, start] = useTransition();
  if (!versions.length) {
    return <EmptyState icon={<History />} title="No previous versions" description="A snapshot is saved automatically every time you change this agent." />;
  }
  return (
    <ol className="relative space-y-3 border-l pl-6">
      {versions.map((v) => (
        <li key={v.id} className="relative rounded-xl border bg-card p-4">
          <span className="absolute top-5 -left-[31px] size-2.5 rounded-full border-2 border-background bg-primary" />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm"><span className="font-semibold">v{v.version}</span> <span className="text-muted-foreground">· {v.snapshot.name} · {v.snapshot.model} · <LocalTime iso={v.created_at} format="short" /></span></p>
            <ConfirmDialog
              title={`Restore v${v.version}?`}
              description="The current configuration is saved as a new version first, so you can undo this."
              confirmLabel="Restore"
              onConfirm={() => start(async () => { await restoreAgentVersion(agentId, v.id); toast.success(`Restored v${v.version}`); })}
              trigger={<Button size="sm" variant="outline" loading={pending}><RotateCcw /> Restore</Button>}
            />
          </div>
          {v.snapshot.instructions && <p className="mt-2 line-clamp-2 font-mono text-xs text-muted-foreground">{v.snapshot.instructions}</p>}
        </li>
      ))}
    </ol>
  );
}
