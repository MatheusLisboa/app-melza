import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPushConfigured } from "@/lib/push/web-push";
import { notifyUserOnce } from "@/lib/push/notify";
import {
  computeEntreNosSettlement,
  ENTRE_NOS_TX_SELECT,
  entreNosMonthQueryRange,
  filterEntreNosTxsForMonth,
  type EntreNosTx,
} from "@/lib/finance/entre-nos";
import { formatCurrency, toISODate, startOfMonth } from "@/lib/utils/format";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorizeCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const url = new URL(req.url);
  return url.searchParams.get("secret") === secret;
}

/** Dias até o vencimento do cartão (0 = hoje, 1 = amanhã). null se sem due_day. */
function daysUntilDue(dueDay: number, today = new Date()): number | null {
  if (dueDay < 1 || dueDay > 31) return null;
  const y = today.getFullYear();
  const m = today.getMonth();
  const last = new Date(y, m + 1, 0).getDate();
  const dueThisMonth = Math.min(dueDay, last);
  let due = new Date(y, m, dueThisMonth);
  const todayStart = new Date(y, m, today.getDate());
  if (due < todayStart) {
    const nextLast = new Date(y, m + 2, 0).getDate();
    due = new Date(y, m + 1, Math.min(dueDay, nextLast));
  }
  return Math.round((due.getTime() - todayStart.getTime()) / 86_400_000);
}

async function runEntreNosReminders(todayISO: string) {
  const admin = createAdminClient();
  const today = new Date(todayISO + "T12:00:00");
  const month = startOfMonth(today);
  const range = entreNosMonthQueryRange(month);

  const { data: workspaces } = await admin
    .from("workspaces")
    .select("id, name, type")
    .in("type", ["COUPLE", "FAMILY", "SHARED"]);

  let notified = 0;

  for (const ws of workspaces ?? []) {
    const { data: members } = await admin
      .from("workspace_members")
      .select("id, display_name, user_id")
      .eq("workspace_id", ws.id);
    if (!members || members.length < 2) continue;

    const { data: txsRaw } = await admin
      .from("transactions")
      .select(ENTRE_NOS_TX_SELECT)
      .eq("workspace_id", ws.id)
      .in("transaction_type", ["expense", "loan_given", "settlement"])
      .neq("status", "cancelled")
      .gte("transaction_date", range.from)
      .lte("transaction_date", range.to)
      .order("transaction_date", { ascending: false })
      .limit(500);

    const txs = filterEntreNosTxsForMonth(
      (txsRaw ?? []) as EntreNosTx[],
      month
    );
    const settlement = computeEntreNosSettlement(
      members.map((m) => ({ id: m.id, display_name: m.display_name })),
      txs,
      { month }
    );

    if (settlement.balanced || !settlement.debtor || settlement.netAmount < 1) {
      continue;
    }
    if (!settlement.oldestOpenDate) continue;

    const then = new Date(settlement.oldestOpenDate + "T12:00:00");
    const now = new Date(todayISO + "T12:00:00");
    const daysOpen = Math.floor((now.getTime() - then.getTime()) / 86_400_000);
    if (daysOpen < 7) continue;

    const debtor = members.find((m) => m.id === settlement.debtor!.id);
    const creditor = members.find((m) => m.id === settlement.creditor?.id);
    if (!debtor?.user_id) continue;

    const result = await notifyUserOnce(
      debtor.user_id,
      "entre_nos_debt",
      `${ws.id}:${todayISO}`,
      {
        title: "Lembrete Entre Nós",
        body: `Neste mês você deve ${formatCurrency(settlement.netAmount)}${
          creditor ? ` a ${creditor.display_name}` : ""
        } há ${daysOpen} dias`,
        url: "/entre-nos",
        tag: `entre-nos-${ws.id}`,
      }
    );
    notified += result.sent;
  }

  return notified;
}

async function runInvoiceDueReminders(todayISO: string) {
  const admin = createAdminClient();
  const today = new Date(todayISO + "T12:00:00");
  const { data: cards } = await admin
    .from("cards")
    .select("id, name, due_day, owner_member_id, workspace_id, is_active")
    .eq("is_active", true)
    .not("due_day", "is", null);

  let notified = 0;

  for (const card of cards ?? []) {
    const dueDay = Number(card.due_day);
    const days = daysUntilDue(dueDay, today);
    if (days !== 0 && days !== 1) continue;
    if (!card.owner_member_id) continue;

    const { data: owner } = await admin
      .from("workspace_members")
      .select("user_id, display_name")
      .eq("id", card.owner_member_id)
      .maybeSingle();
    if (!owner?.user_id) continue;

    const when = days === 0 ? "hoje" : "amanhã";
    const result = await notifyUserOnce(
      owner.user_id,
      "invoice_due",
      `${card.id}:${todayISO}`,
      {
        title: "Fatura vencendo",
        body: `${card.name} vence ${when} (dia ${dueDay})`,
        url: "/invoices",
        tag: `invoice-${card.id}`,
      }
    );
    notified += result.sent;
  }

  return notified;
}

export async function GET(req: Request) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isPushConfigured()) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "VAPID não configurado",
    });
  }

  const todayISO = toISODate(new Date());
  const entreNos = await runEntreNosReminders(todayISO);
  const invoices = await runInvoiceDueReminders(todayISO);

  return NextResponse.json({
    ok: true,
    date: todayISO,
    entreNosSent: entreNos,
    invoiceSent: invoices,
  });
}
