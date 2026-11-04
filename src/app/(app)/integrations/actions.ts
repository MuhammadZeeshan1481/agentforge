"use server";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/workspace";

export async function disconnect(provider: string) {
  const { supabase, workspace, isAdmin } = await getContext();
  if (!isAdmin) return;
  await supabase.from("connections").delete().eq("workspace_id", workspace.id).eq("provider", provider);
  revalidatePath("/integrations");
}
