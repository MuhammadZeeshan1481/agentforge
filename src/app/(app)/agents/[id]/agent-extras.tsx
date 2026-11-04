import { Card } from "@/components/ui";
import { LocalTime } from "@/components/local-time";
import { clearMemories, deleteMemory, restoreAgentVersion } from "../actions";

export function MemoryPanel({
  agentId,
  memories,
}: {
  agentId: string;
  memories: { id: number; content: string; created_at: string }[];
}) {
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Memory</h2>
        {memories.length > 0 && (
          <form action={clearMemories.bind(null, agentId)}>
            <button className="text-xs text-red-600 hover:underline">Clear all</button>
          </form>
        )}
      </div>
      {memories.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Nothing remembered yet. The agent saves facts with its save_memory tool during runs.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
          {memories.map((m) => (
            <li key={m.id} className="flex items-start justify-between gap-3 py-2">
              <span>{m.content}</span>
              <form action={deleteMemory.bind(null, agentId, m.id)}>
                <button className="shrink-0 text-xs text-zinc-500 hover:text-red-600">Remove</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function VersionsPanel({
  agentId,
  versions,
}: {
  agentId: string;
  versions: { id: number; version: number; created_at: string; snapshot: { name?: string; model?: string } }[];
}) {
  return (
    <Card>
      <h2 className="mb-3 font-semibold">Version history</h2>
      {versions.length === 0 ? (
        <p className="text-sm text-zinc-500">A version is saved every time you change this agent.</p>
      ) : (
        <ul className="divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
          {versions.map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-3 py-2">
              <span>
                <span className="font-medium">v{v.version}</span>
                <span className="ml-2 text-zinc-500">
                  {v.snapshot.name} · {v.snapshot.model} · <LocalTime iso={v.created_at} format="short" />
                </span>
              </span>
              <form action={restoreAgentVersion.bind(null, agentId, v.id)}>
                <button className="text-xs font-medium text-indigo-600 hover:underline">Restore</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
