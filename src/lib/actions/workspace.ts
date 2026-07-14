"use server";

import { revalidatePath } from "next/cache";
import { setActiveWorkspaceId } from "@/lib/supabase/workspace";
import { createClient } from "@/lib/supabase/server";

export async function setActiveWorkspaceAction(workspaceId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Não autenticado");
  }

  const { data } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("user_id", user.id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!data) {
    throw new Error("Workspace inválido");
  }

  await setActiveWorkspaceId(workspaceId);
}

/**
 * Apaga o workspace se o usuário for owner. Troca o cookie
 * para outro workspace restante (preferência: PERSONAL).
 */
export async function deleteWorkspaceAction(workspaceId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Não autenticado" };
  }

  const { data: membership, error: memError } = await supabase
    .from("workspace_members")
    .select("id, role, workspace:workspaces(id, name, type)")
    .eq("user_id", user.id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (memError) return { error: memError.message };
  if (!membership) return { error: "Workspace não encontrado" };
  if (membership.role !== "owner") {
    return { error: "Só quem criou o workspace pode apagá-lo" };
  }

  const { data: remaining } = await supabase
    .from("workspace_members")
    .select("workspace_id, workspace:workspaces(type)")
    .eq("user_id", user.id)
    .neq("workspace_id", workspaceId);

  const { error: delError } = await supabase
    .from("workspaces")
    .delete()
    .eq("id", workspaceId);

  if (delError) {
    return {
      error:
        delError.message.includes("policy") || delError.code === "42501"
          ? "Sem permissão para apagar. Rode a migration 006 no Supabase."
          : delError.message,
    };
  }

  const next =
    remaining?.find(
      (m) =>
        (m.workspace as { type?: string } | null)?.type === "PERSONAL"
    ) ?? remaining?.[0];

  if (next?.workspace_id) {
    await setActiveWorkspaceId(next.workspace_id);
  }

  revalidatePath("/", "layout");
  return { success: true, nextWorkspaceId: next?.workspace_id ?? null };
}
