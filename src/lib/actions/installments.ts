"use server";

import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/supabase/workspace";
import { dateForInstallmentInSeries } from "@/lib/finance/installment-dates";

type InstallmentRow = {
  id: string;
  amount: number;
  description: string;
  transaction_date: string;
  card_id: string | null;
  paid_by_member_id: string | null;
  consumer_member_id: string | null;
  consumer_share_percent: number | null;
  category_id: string | null;
  tags: string[] | null;
  is_installment: boolean | null;
  installment_number: number | null;
  total_installments: number | null;
  installment_group_id: string | null;
  status: string | null;
};

/**
 * Completa parcelas futuras que faltam (ex.: import antigo só trouxe a parcela do mês).
 * Idempotente: não duplica número já existente no grupo.
 */
export async function backfillInstallmentSchedulesAction() {
  const member = await requireMember();
  const supabase = await createClient();

  const { data: rows, error } = await supabase
    .from("transactions")
    .select(
      `
      id, amount, description, transaction_date, card_id,
      paid_by_member_id, consumer_member_id, consumer_share_percent,
      category_id, tags, is_installment, installment_number,
      total_installments, installment_group_id, status
    `
    )
    .eq("workspace_id", member.workspace_id)
    .eq("is_installment", true)
    .neq("status", "cancelled")
    .not("installment_group_id", "is", null)
    .not("total_installments", "is", null);

  if (error) return { error: error.message, created: 0 };

  const list = (rows ?? []) as InstallmentRow[];
  const byGroup = new Map<string, InstallmentRow[]>();
  for (const row of list) {
    const gid = row.installment_group_id;
    if (!gid) continue;
    const arr = byGroup.get(gid) ?? [];
    arr.push(row);
    byGroup.set(gid, arr);
  }

  const cardIds = Array.from(
    new Set(list.map((r) => r.card_id).filter(Boolean) as string[])
  );
  const cardMeta = new Map<
    string,
    { closing_day: number | null; due_day: number | null }
  >();
  if (cardIds.length > 0) {
    const { data: cards } = await supabase
      .from("cards")
      .select("id, closing_day, due_day")
      .eq("workspace_id", member.workspace_id)
      .in("id", cardIds);
    for (const c of cards ?? []) {
      cardMeta.set(c.id, {
        closing_day:
          typeof c.closing_day === "number" ? c.closing_day : null,
        due_day: typeof c.due_day === "number" ? c.due_day : null,
      });
    }
  }

  const toInsert: Record<string, unknown>[] = [];

  for (const [, group] of Array.from(byGroup.entries())) {
    const total = group[0]?.total_installments ?? 0;
    if (total < 2) continue;

    const byNumber = new Map<number, InstallmentRow>();
    for (const row of group) {
      if (row.installment_number != null) {
        byNumber.set(row.installment_number, row);
      }
    }

    const present = Array.from(byNumber.keys()).sort((a, b) => a - b);
    if (present.length === 0) continue;
    const maxPresent = present[present.length - 1]!;
    if (maxPresent >= total) continue;

    const anchor = byNumber.get(maxPresent)!;
    const meta = anchor.card_id ? cardMeta.get(anchor.card_id) : null;
    const baseDesc = anchor.description.replace(/\s*\(\d+\/\d+\)\s*$/, "");

    for (let n = maxPresent + 1; n <= total; n++) {
      if (byNumber.has(n)) continue;
      toInsert.push({
        workspace_id: member.workspace_id,
        created_by_member_id: member.id,
        paid_by_member_id: anchor.paid_by_member_id ?? member.id,
        consumer_member_id: anchor.consumer_member_id ?? member.id,
        consumer_share_percent: anchor.consumer_share_percent ?? 100,
        amount: Number(anchor.amount),
        currency: "BRL",
        transaction_type: "expense",
        description: `${baseDesc} (${n}/${total})`,
        notes: "Parcela futura gerada automaticamente",
        category_id: anchor.category_id,
        card_id: anchor.card_id,
        account_id: null,
        tags: anchor.tags ?? ["installment", "backfill"],
        is_installment: true,
        installment_number: n,
        total_installments: total,
        installment_group_id: anchor.installment_group_id,
        transaction_date: dateForInstallmentInSeries({
          knownISO: anchor.transaction_date,
          knownNumber: maxPresent,
          targetNumber: n,
          closingDay: meta?.closing_day,
          dueDay: meta?.due_day,
        }),
        status: "scheduled",
        paid_at: null,
      });
    }
  }

  if (toInsert.length === 0) {
    return { ok: true as const, created: 0 };
  }

  // batch insert
  const chunk = 100;
  let created = 0;
  for (let i = 0; i < toInsert.length; i += chunk) {
    const slice = toInsert.slice(i, i + chunk);
    const { error: insErr } = await supabase.from("transactions").insert(slice);
    if (insErr) return { error: insErr.message, created };
    created += slice.length;
  }

  return { ok: true as const, created };
}
