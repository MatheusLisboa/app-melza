"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/supabase/workspace";

/** Encerra sessão (cookies SSR) + cookie do workspace ativo. */
export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const cookieStore = cookies();
  cookieStore.delete(ACTIVE_WORKSPACE_COOKIE);

  // Limpa cookies sb-* legados se existirem
  for (const c of cookieStore.getAll()) {
    if (c.name.startsWith("sb-")) {
      cookieStore.delete(c.name);
    }
  }

  return { ok: true as const };
}
