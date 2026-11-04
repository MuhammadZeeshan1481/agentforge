"use client";
import { createStore } from "zustand/vanilla";
import type { WorkflowStep } from "@/lib/workflows";

export type BuilderStep = WorkflowStep & { uid: string };
export type StepType = WorkflowStep["type"];

export type BuilderState = {
  steps: BuilderStep[];
  selected: string | null;
  insert: (type: StepType, index?: number) => void;
  update: (uid: string, patch: Partial<WorkflowStep>) => void;
  remove: (uid: string) => void;
  move: (from: number, to: number) => void;
  select: (uid: string | null) => void;
};

const uid = () => Math.random().toString(36).slice(2, 10);

export function createBuilderStore(initial: WorkflowStep[], defaultAgentId: string) {
  const blank = (type: StepType): WorkflowStep =>
    type === "agent"
      ? { type, agent_id: defaultAgentId, input: "{{previous}}" }
      : type === "approval"
        ? { type, message: "Review the output above before continuing." }
        : { type, mode: "contains", value: "" };

  return createStore<BuilderState>()((set) => ({
    steps: (initial.length ? initial : [{ type: "agent", agent_id: defaultAgentId, input: "{{input}}" } as WorkflowStep]).map((s) => ({ ...s, uid: uid() })),
    selected: null,
    insert: (type, index) =>
      set((s) => {
        const step = { ...blank(type), uid: uid() } as BuilderStep;
        const steps = [...s.steps];
        steps.splice(index ?? steps.length, 0, step);
        return { steps, selected: step.uid };
      }),
    update: (id, patch) => set((s) => ({ steps: s.steps.map((st) => (st.uid === id ? ({ ...st, ...patch } as BuilderStep) : st)) })),
    remove: (id) => set((s) => ({ steps: s.steps.filter((st) => st.uid !== id), selected: s.selected === id ? null : s.selected })),
    move: (from, to) =>
      set((s) => {
        const steps = [...s.steps];
        const [item] = steps.splice(from, 1);
        steps.splice(to, 0, item);
        return { steps };
      }),
    select: (id) => set({ selected: id }),
  }));
}
