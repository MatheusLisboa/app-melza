import { NextResponse } from "next/server";
import { getAppShell } from "@/lib/supabase/workspace";

/** Shell leve p/ o client — evita await no layout a cada navegação. */
export async function GET() {
  const shell = await getAppShell();
  if (!shell) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  return NextResponse.json({
    member: shell.member,
    memberships: shell.memberships.filter((m) => Boolean(m.workspace?.id)),
  });
}
