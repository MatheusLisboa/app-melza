import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const limited = rateLimit({
    key: `export:${user.id}:${clientIp(request)}`,
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Limite de exportação. Tente mais tarde." },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      }
    );
  }

  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("*, workspace:workspaces(*)")
    .eq("user_id", user.id);

  const workspaceIds = (memberships ?? []).map((m) => m.workspace_id);

  const [transactions, cards, accounts, categories, subscriptions, loans, thirdParties] =
    await Promise.all([
      workspaceIds.length
        ? supabase.from("transactions").select("*").in("workspace_id", workspaceIds)
        : Promise.resolve({ data: [] }),
      workspaceIds.length
        ? supabase.from("cards").select("*").in("workspace_id", workspaceIds)
        : Promise.resolve({ data: [] }),
      workspaceIds.length
        ? supabase.from("accounts").select("*").in("workspace_id", workspaceIds)
        : Promise.resolve({ data: [] }),
      workspaceIds.length
        ? supabase.from("categories").select("*").in("workspace_id", workspaceIds)
        : Promise.resolve({ data: [] }),
      workspaceIds.length
        ? supabase.from("subscriptions").select("*").in("workspace_id", workspaceIds)
        : Promise.resolve({ data: [] }),
      workspaceIds.length
        ? supabase.from("loans").select("*").in("workspace_id", workspaceIds)
        : Promise.resolve({ data: [] }),
      workspaceIds.length
        ? supabase.from("third_parties").select("*").in("workspace_id", workspaceIds)
        : Promise.resolve({ data: [] }),
    ]);

  const payload = {
    exported_at: new Date().toISOString(),
    user: { id: user.id, email: user.email },
    memberships,
    transactions: transactions.data,
    cards: cards.data,
    accounts: accounts.data,
    categories: categories.data,
    subscriptions: subscriptions.data,
    loans: loans.data,
    third_parties: thirdParties.data,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="financas-casa-export.json"`,
    },
  });
}
