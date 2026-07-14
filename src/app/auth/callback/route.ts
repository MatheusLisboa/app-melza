import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { setActiveWorkspaceId } from "@/lib/supabase/workspace";

/**
 * Callback OAuth / magic link do Supabase Auth.
 * Troca o code por sessão, ativa o workspace pessoal e redireciona.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: rows } = await supabase
          .from("workspace_members")
          .select("workspace_id, workspace:workspaces(type)")
          .eq("user_id", user.id);
        const personal = (rows ?? []).find(
          (m) =>
            (m.workspace as { type?: string } | null)?.type === "PERSONAL"
        );
        if (personal?.workspace_id) {
          await setActiveWorkspaceId(personal.workspace_id);
        }
      }

      const safeNext =
        next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback`);
}
