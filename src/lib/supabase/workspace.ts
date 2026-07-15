import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { Workspace, WorkspaceMember, WorkspaceType } from "@/types";

export const ACTIVE_WORKSPACE_COOKIE = "active_workspace_id";

const SHARED_TYPES: WorkspaceType[] = ["COUPLE", "FAMILY", "SHARED"];

type MemberWithWorkspace = WorkspaceMember & {
  workspace: Workspace | null;
};

function pickPreferredMembership(
  memberships: MemberWithWorkspace[],
  activeId: string | undefined
): MemberWithWorkspace | null {
  if (!memberships.length) return null;

  // Cookie válido = troca explícita do usuário nesta sessão
  if (activeId) {
    const active = memberships.find((m) => m.workspace_id === activeId);
    if (active) return active;
  }

  // Padrão sempre: workspace pessoal
  const personal = memberships.find((m) => m.workspace?.type === "PERSONAL");
  return personal ?? memberships[0];
}

export async function setActiveWorkspaceId(workspaceId: string) {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_WORKSPACE_COOKIE, workspaceId, {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });
}

/** Dedupa por request (layout + pages). */
export const listUserMemberships = cache(
  async (userId?: string): Promise<MemberWithWorkspace[]> => {
    const supabase = await createClient();
    let uid = userId;
    if (!uid) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [];
      uid = user.id;
    }

    const { data } = await supabase
      .from("workspace_members")
      .select("*, workspace:workspaces(*)")
      .eq("user_id", uid)
      .order("created_at", { ascending: true });

    // Ignora memberships órfãs (workspace apagado / join nulo)
    return ((data as MemberWithWorkspace[] | null) ?? []).filter((m) =>
      Boolean(m.workspace?.id)
    );
  }
);

/** Shell do app: 1 round-trip de memberships por request. */
export const getAppShell = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  let memberships = await listUserMemberships(user.id);

  if (!memberships.length) {
    const display =
      (user.user_metadata?.display_name as string | undefined) ||
      user.email?.split("@")[0] ||
      "Eu";
    await supabase.rpc("create_personal_workspace_for_user", {
      p_user_id: user.id,
      p_display_name: display,
      p_avatar_color: "#111111",
    });
    // invalida cache local da request: chamar again via uncached path
    const { data } = await supabase
      .from("workspace_members")
      .select("*, workspace:workspaces(*)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    memberships = ((data as MemberWithWorkspace[] | null) ?? []).filter(
      (m) => Boolean(m.workspace?.id)
    );
  }

  const cookieStore = await cookies();
  const activeId = cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value;
  const member = pickPreferredMembership(memberships, activeId);
  if (!member) return null;

  return { member, memberships, userId: user.id };
});

/** Usuário só tem PERSONAL (ainda não criou/juntou workspace compartilhado). */
export async function needsSharedWorkspaceOnboarding(): Promise<boolean> {
  const memberships = await listUserMemberships();
  if (!memberships.length) return true;
  return !memberships.some(
    (m) => m.workspace && SHARED_TYPES.includes(m.workspace.type)
  );
}

export async function getCurrentMember(): Promise<WorkspaceMember | null> {
  const shell = await getAppShell();
  return shell?.member ?? null;
}

export async function requireMember(): Promise<WorkspaceMember> {
  const member = await getCurrentMember();
  if (!member) {
    throw new Error("NOT_A_MEMBER");
  }
  return member;
}
