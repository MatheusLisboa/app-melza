import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";

/**
 * Apaga dados dos workspaces onde o user é o único membro owner PERSONAL,
 * remove memberships, e deleta o usuário auth (requer service role).
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const limited = rateLimit({
    key: `delete:${user.id}:${clientIp(request)}`,
    limit: 3,
    windowMs: 60 * 60 * 1000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Limite atingido. Tente mais tarde." },
      { status: 429 }
    );
  }

  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("*, workspace:workspaces(*)")
    .eq("user_id", user.id);

  for (const m of memberships ?? []) {
    const { count } = await supabase
      .from("workspace_members")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", m.workspace_id);

    // Se é o único membro, apaga o workspace (cascade remove dados)
    if ((count ?? 0) <= 1) {
      await supabase.from("workspaces").delete().eq("id", m.workspace_id);
    } else {
      await supabase.from("workspace_members").delete().eq("id", m.id);
    }
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) {
      return NextResponse.json(
        {
          error:
            "Dados removidos, mas não foi possível apagar a conta Auth. Configure SUPABASE_SERVICE_ROLE_KEY ou apague o usuário no console.",
          code: "AUTH_DELETE_FAILED",
          detail: error.message,
        },
        { status: 207 }
      );
    }
  } catch {
    return NextResponse.json(
      {
        error:
          "Dados do app removidos. Configure SUPABASE_SERVICE_ROLE_KEY para apagar a conta Auth automaticamente.",
        code: "MISSING_SERVICE_ROLE",
      },
      { status: 207 }
    );
  }

  return NextResponse.json({ ok: true });
}
