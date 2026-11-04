"use server";
import { z } from "zod";
import { getContext } from "@/lib/workspace";
import { getTemplate } from "@/lib/templates";

export type State = { error?: string; redirectTo?: string };

export async function completeOnboarding(_: State, formData: FormData): Promise<State> {
  const { supabase, user, workspace } = await getContext();
  const parsed = z
    .object({
      name: z.string().trim().min(1, "Enter your name").max(100),
      workspace: z.string().trim().min(1, "Name your workspace").max(100),
      template: z.string().optional(),
    })
    .safeParse({ name: formData.get("name"), workspace: formData.get("workspace"), template: formData.get("template") || undefined });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await supabase.from("profiles").update({ full_name: parsed.data.name, onboarded: true, updated_at: new Date().toISOString() }).eq("id", user.id);
  if (workspace.owner_id === user.id) await supabase.from("workspaces").update({ name: parsed.data.workspace }).eq("id", workspace.id);

  const tpl = getTemplate(parsed.data.template);
  if (tpl) {
    const { data } = await supabase
      .from("agents")
      .insert({
        workspace_id: workspace.id,
        created_by: user.id,
        name: tpl.name,
        description: tpl.description,
        instructions: tpl.instructions,
        tools: tpl.tools,
        max_steps: tpl.max_steps,
      })
      .select("id")
      .single();
    if (data) return { redirectTo: `/agents/${data.id}?welcome=1` };
  }
  return { redirectTo: "/dashboard?welcome=1" };
}
