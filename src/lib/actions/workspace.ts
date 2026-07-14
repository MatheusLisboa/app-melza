"use server";

import { revalidatePath } from "next/cache";
import {
  setActiveWorkspaceId,
  ACTIVE_WORKSPACE_COOKIE,
} from "@/lib/supabase/workspace";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

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
    .select("id, workspace:workspaces(id)")
    .eq("user_id", user.id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!data?.workspace) {
    throw new Error("Workspace inválido");
  }

  await setActiveWorkspaceId(workspaceId);
}

/** Define o cookie ativo para o workspace PERSONAL do usuário. */
export async function activatePersonalWorkspaceAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Não autenticado" };
  }

  const { data: rows } = await supabase
    .from("workspace_members")
    .select("workspace_id, workspace:workspaces(id, type)")
    .eq("user_id", user.id);

  const personal = (rows ?? []).find(
    (m) => (m.workspace as { type?: string } | null)?.type === "PERSONAL"
  );

  if (!personal?.workspace_id) {
    return { error: "Workspace pessoal não encontrado" };
  }

  await setActiveWorkspaceId(personal.workspace_id);
  return { success: true, workspaceId: personal.workspace_id };
}

/**
 * Apaga o workspace se o usuário for owner (RPC SECURITY DEFINER).
 * Sempre volta para o workspace pessoal.
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

  const ws = membership.workspace as { type?: string } | null;
  if (ws?.type === "PERSONAL") {
    const { count } = await supabase
      .from("workspace_members")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    if ((count ?? 0) <= 1) {
      return {
        error: "Não é possível apagar o workspace pessoal quando é o único.",
      };
    }
  }

  const { data: ok, error: rpcError } = await supabase.rpc(
    "delete_workspace_as_owner",
    { p_workspace_id: workspaceId }
  );

  if (rpcError) {
    const msg = rpcError.message ?? "";
    if (msg.includes("not_owner")) {
      return { error: "Só quem criou o workspace pode apagá-lo" };
    }
    if (msg.includes("cannot_delete_only_personal")) {
      return {
        error: "Não é possível apagar o workspace pessoal quando é o único.",
      };
    }
    if (
      msg.includes("function") &&
      msg.toLowerCase().includes("does not exist")
    ) {
      return {
        error:
          "Função de exclusão ausente. Rode a migration 007_delete_workspace_rpc.sql no Supabase.",
      };
    }
    return { error: rpcError.message };
  }

  if (!ok) {
    return { error: "Workspace não encontrado ou já apagado" };
  }

  // Confirma remoção
  const { data: stillThere } = await supabase
    .from("workspaces")
    .select("id")
    .eq("id", workspaceId)
    .maybeSingle();
  if (stillThere) {
    return { error: "Falha ao confirmar exclusão do workspace" };
  }

  // Volta sempre para o pessoal
  const { data: personalRows } = await supabase
    .from("workspace_members")
    .select("workspace_id, workspace:workspaces(type)")
    .eq("user_id", user.id);

  const personal = (personalRows ?? []).find(
    (m) => (m.workspace as { type?: string } | null)?.type === "PERSONAL"
  );
  const nextId = personal?.workspace_id ?? personalRows?.[0]?.workspace_id;

  if (nextId) {
    await setActiveWorkspaceId(nextId);
  } else {
    const cookieStore = await cookies();
    cookieStore.delete(ACTIVE_WORKSPACE_COOKIE);
  }

  revalidatePath("/", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/settings");
  revalidatePath("/api/shell");
  return { success: true, nextWorkspaceId: nextId ?? null };
}
