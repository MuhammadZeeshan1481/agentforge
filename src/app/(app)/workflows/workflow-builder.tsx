"use client";
import { createContext, useContext, useId, useState } from "react";
import { useStore } from "zustand";
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Bot, CalendarClock, Filter, GripVertical, Hand, Plus, ShieldCheck, Trash2, Webhook, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input, NativeSelect, Textarea } from "@/components/ui";
import type { WorkflowStep } from "@/lib/workflows";
import { createBuilderStore, type BuilderState, type BuilderStep, type StepType } from "@/stores/workflow-builder";

type Store = ReturnType<typeof createBuilderStore>;
const Ctx = createContext<Store | null>(null);
function useBuilder<T>(sel: (s: BuilderState) => T) {
  const store = useContext(Ctx);
  if (!store) throw new Error("Builder store missing");
  return useStore(store, sel);
}

const PALETTE: { type: StepType; label: string; text: string; icon: typeof Bot; tone: string }[] = [
  { type: "agent", label: "Agent", text: "Run an agent on the input or previous output", icon: Bot, tone: "bg-primary/10 text-primary" },
  { type: "approval", label: "Human approval", text: "Pause until someone approves", icon: ShieldCheck, tone: "bg-warning/15 text-[color:var(--warning)]" },
  { type: "condition", label: "Condition", text: "Continue only if the output matches", icon: Filter, tone: "bg-success/12 text-success" },
];
const meta = (t: StepType) => PALETTE.find((p) => p.type === t)!;

export function useWorkflowBuilder(initial: WorkflowStep[], defaultAgentId: string) {
  const [store] = useState(() => createBuilderStore(initial, defaultAgentId));
  return store;
}

export function WorkflowBuilder({
  store,
  agents,
  trigger,
}: {
  store: Store;
  agents: { id: string; name: string }[];
  trigger: { type: string; interval?: string | null };
}) {
  return (
    <Ctx.Provider value={store}>
      <BuilderInner agents={agents} trigger={trigger} />
    </Ctx.Provider>
  );
}

function BuilderInner({ agents, trigger }: { agents: { id: string; name: string }[]; trigger: { type: string; interval?: string | null } }) {
  const steps = useBuilder((s) => s.steps);
  const insert = useBuilder((s) => s.insert);
  const move = useBuilder((s) => s.move);
  const [dragging, setDragging] = useState<string | null>(null);
  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragStart = (e: DragStartEvent) => setDragging(String(e.active.id));
  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    const a = String(e.active.id);
    const o = e.over ? String(e.over.id) : null;
    if (!o) return;
    if (a.startsWith("palette:")) {
      const type = a.slice(8) as StepType;
      const idx = o === "canvas-end" ? steps.length : Math.max(0, steps.findIndex((s) => s.uid === o));
      insert(type, idx === -1 ? steps.length : idx);
      return;
    }
    const from = steps.findIndex((s) => s.uid === a);
    const to = o === "canvas-end" ? steps.length - 1 : steps.findIndex((s) => s.uid === o);
    if (from !== -1 && to !== -1 && from !== to) move(from, to);
  };

  return (
    <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <div className="space-y-2 lg:sticky lg:top-6 lg:self-start">
          <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">Steps</p>
          <p className="text-xs text-muted-foreground">Drag onto the canvas, or click to append.</p>
          {PALETTE.map((p) => <PaletteItem key={p.type} {...p} onAdd={() => insert(p.type)} />)}
          <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Variables</p>
            <p className="mt-1"><code>{"{{input}}"}</code> run input</p>
            <p><code>{"{{previous}}"}</code> last agent output</p>
            <p><code>{"{{step1}}"}</code>, <code>{"{{step2}}"}</code>… a step’s output</p>
          </div>
        </div>

        <div className="bg-grid min-w-0 rounded-xl border bg-muted/30 p-4 sm:p-6">
          <div className="mx-auto max-w-xl">
            <TriggerNode type={trigger.type} interval={trigger.interval} />
            <SortableContext items={steps.map((s) => s.uid)} strategy={verticalListSortingStrategy}>
              {steps.map((s, i) => (
                <div key={s.uid}>
                  <Connector />
                  <StepNode step={s} index={i} agents={agents} canRemove={steps.length > 1} />
                </div>
              ))}
            </SortableContext>
            <Connector />
            <EndDrop active={dragging?.startsWith("palette:") ?? false} />
          </div>
        </div>
      </div>
      <DragOverlay dropAnimation={null}>
        {dragging?.startsWith("palette:") ? <PaletteCard {...meta(dragging.slice(8) as StepType)} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function PaletteCard({ label, text, icon: Icon, tone, overlay }: { label: string; text: string; icon: typeof Bot; tone: string; overlay?: boolean }) {
  return (
    <div className={cn("flex items-start gap-3 rounded-lg border bg-card p-3 text-left shadow-xs", overlay && "w-60 rotate-2 shadow-xl ring-2 ring-primary/30")}>
      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-md", tone)}><Icon className="size-4" /></span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{text}</span>
      </span>
    </div>
  );
}

function PaletteItem(p: (typeof PALETTE)[number] & { onAdd: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `palette:${p.type}` });
  return (
    <div className="group relative">
      <button type="button" ref={setNodeRef} {...listeners} {...attributes} onClick={p.onAdd} className={cn("block w-full cursor-grab touch-none active:cursor-grabbing", isDragging && "opacity-40")} aria-label={`Add ${p.label} step`}>
        <PaletteCard {...p} />
      </button>
      <Plus className="pointer-events-none absolute top-3 right-3 size-4 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
    </div>
  );
}

function Connector() {
  return <div className="mx-auto h-6 w-px bg-gradient-to-b from-border to-primary/40" />;
}

function TriggerNode({ type, interval }: { type: string; interval?: string | null }) {
  const t =
    type === "webhook" ? { icon: Webhook, label: "Webhook", text: "Starts when an HTTP POST arrives" }
    : type === "schedule" ? { icon: CalendarClock, label: "Schedule", text: `Runs every ${interval?.replace("ly", "") ?? "day"}` }
    : { icon: Hand, label: "Manual or API", text: "Starts from the Run button or the API" };
  return (
    <div className="flex items-center gap-3 rounded-xl border-2 border-dashed border-sky-500/40 bg-card px-4 py-3">
      <span className="flex size-9 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400"><t.icon className="size-4" /></span>
      <div>
        <p className="flex items-center gap-1.5 text-sm font-medium"><Zap className="size-3.5 text-sky-500" /> Trigger · {t.label}</p>
        <p className="text-xs text-muted-foreground">{t.text}</p>
      </div>
    </div>
  );
}

function EndDrop({ active }: { active: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: "canvas-end" });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex h-14 items-center justify-center rounded-xl border-2 border-dashed text-xs text-muted-foreground transition",
        active && "border-primary/50 bg-primary/5 text-primary",
        isOver && "border-primary bg-primary/10",
      )}
    >
      {active ? "Drop here to add at the end" : "End of workflow"}
    </div>
  );
}

function StepNode({ step, index, agents, canRemove }: { step: BuilderStep; index: number; agents: { id: string; name: string }[]; canRemove: boolean }) {
  const update = useBuilder((s) => s.update);
  const remove = useBuilder((s) => s.remove);
  const select = useBuilder((s) => s.select);
  const selected = useBuilder((s) => s.selected === step.uid);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({ id: step.uid });
  const m = meta(step.type);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onClick={() => select(step.uid)}
      className={cn(
        "relative rounded-xl border bg-card shadow-xs transition-shadow",
        selected && "ring-2 ring-primary/40",
        isDragging && "z-10 opacity-80 shadow-xl",
        isOver && "ring-2 ring-primary/30",
      )}
    >
      <div className="flex items-center gap-3 border-b px-3 py-2.5">
        <button type="button" {...attributes} {...listeners} className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing" aria-label={`Drag step ${index + 1}`}>
          <GripVertical className="size-4" />
        </button>
        <span className={cn("flex size-7 items-center justify-center rounded-md", m.tone)}><m.icon className="size-3.5" /></span>
        <span className="text-sm font-medium">
          <span className="text-muted-foreground">Step {index + 1} ·</span> {m.label}
        </span>
        {canRemove && (
          <button type="button" onClick={(e) => { e.stopPropagation(); remove(step.uid); }} className="ml-auto rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label="Remove step">
            <Trash2 className="size-4" />
          </button>
        )}
      </div>
      <div className="space-y-3 p-3">
        {step.type === "agent" && (
          <>
            <NativeSelect aria-label="Agent" value={step.agent_id} onChange={(e) => update(step.uid, { agent_id: e.target.value })}>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </NativeSelect>
            <Textarea aria-label="Input template" rows={2} value={step.input} onChange={(e) => update(step.uid, { input: e.target.value })} placeholder="{{previous}}" className="font-mono text-xs" />
          </>
        )}
        {step.type === "approval" && (
          <Textarea aria-label="Approval message" rows={2} value={step.message} onChange={(e) => update(step.uid, { message: e.target.value })} placeholder="What should the reviewer check? You can use {{previous}}." />
        )}
        {step.type === "condition" && (
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr]">
            <NativeSelect aria-label="Condition" value={step.mode} onChange={(e) => update(step.uid, { mode: e.target.value as "contains" | "not_contains" })}>
              <option value="contains">Continue if output contains</option>
              <option value="not_contains">Continue if output doesn’t contain</option>
            </NativeSelect>
            <Input aria-label="Condition text" value={step.value} onChange={(e) => update(step.uid, { value: e.target.value })} placeholder="e.g. HOT" />
          </div>
        )}
      </div>
    </div>
  );
}
