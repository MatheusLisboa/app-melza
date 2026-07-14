import type { Card } from "@/types";
import {
  defaultCycleKey,
  listInvoiceCycles,
  type InvoiceCycle,
} from "@/lib/utils/invoice-cycle";
import { normalizeInvoiceDescription } from "@/lib/invoices/match";

export function getCurrentInvoiceCycle(
  card: Pick<Card, "closing_day" | "due_day">,
  today = new Date()
): InvoiceCycle | null {
  const cycles = listInvoiceCycles(
    card.closing_day,
    card.due_day,
    { past: 3, future: 3 },
    today
  );
  if (cycles.length === 0) return null;
  const key = defaultCycleKey(cycles);
  return cycles.find((c) => c.key === key) ?? cycles[0] ?? null;
}

export type CardCycleTx = {
  id: string;
  amount: number;
  transaction_type: string;
  status: string;
  card_id: string | null;
  description: string;
  transaction_date: string;
  is_installment?: boolean | null;
  installment_number?: number | null;
  total_installments?: number | null;
  installment_group_id?: string | null;
};

export function sumCardCycleSpend(
  txs: CardCycleTx[],
  cycle: Pick<InvoiceCycle, "from" | "to">
): number {
  return txs
    .filter(
      (t) =>
        t.transaction_date >= cycle.from &&
        t.transaction_date <= cycle.to &&
        t.transaction_type !== "income" &&
        t.transaction_type !== "loan_received" &&
        t.status !== "cancelled"
    )
    .reduce((s, t) => s + Number(t.amount), 0);
}

function isCardExpense(t: CardCycleTx): boolean {
  return (
    t.transaction_type !== "income" &&
    t.transaction_type !== "loan_received" &&
    t.status !== "cancelled"
  );
}

function installmentGroupKey(t: CardCycleTx): string | null {
  if (t.installment_group_id) return t.installment_group_id;
  const n = t.installment_number;
  const total = t.total_installments;
  if (!n || !total || total < 2) return null;
  return `anon:${normalizeInvoiceDescription(t.description)}|${Number(t.amount).toFixed(2)}|${total}`;
}

/**
 * Limite comprometido = compras do ciclo atual
 * + parcelas futuras ainda abertas (scheduled ou estimadas pelo X/Y).
 */
export function sumCardCommittedLimit(
  txs: CardCycleTx[],
  cycle: Pick<InvoiceCycle, "from" | "to"> | null
): {
  cycleSpend: number;
  futureCommitted: number;
  committed: number;
} {
  const cycleSpend = cycle ? sumCardCycleSpend(txs, cycle) : 0;

  const afterCycle = (t: CardCycleTx) =>
    !cycle || t.transaction_date > cycle.to;

  let futureFromScheduled = 0;
  const scheduledByGroup = new Map<string, number>();

  for (const t of txs) {
    if (!isCardExpense(t) || t.status !== "scheduled" || !afterCycle(t)) {
      continue;
    }
    const amt = Number(t.amount);
    futureFromScheduled += amt;
    const gid = installmentGroupKey(t);
    if (gid) {
      scheduledByGroup.set(gid, (scheduledByGroup.get(gid) ?? 0) + amt);
    }
  }

  /** Parcela “atual” mais avançada por grupo → estima restante (total − n) × valor */
  const estimateByGroup = new Map<string, number>();
  for (const t of txs) {
    if (!isCardExpense(t)) continue;
    const n = t.installment_number;
    const total = t.total_installments;
    if (!n || !total || total <= n) continue;

    const inCycle =
      !!cycle &&
      t.transaction_date >= cycle.from &&
      t.transaction_date <= cycle.to;

    // Usa parcela do ciclo (ou confirmada) como referência do quanto já avançou
    if (!inCycle && t.status !== "confirmed" && t.status !== "pending") {
      continue;
    }

    const gid = installmentGroupKey(t);
    if (!gid) continue;

    const remaining = (total - n) * Number(t.amount);
    const prev = estimateByGroup.get(gid);
    // Menor restante = parcela mais avançada
    if (prev == null || remaining < prev) {
      estimateByGroup.set(gid, remaining);
    }
  }

  let futureCommitted = futureFromScheduled;
  for (const [gid, estimated] of Array.from(estimateByGroup.entries())) {
    const scheduled = scheduledByGroup.get(gid) ?? 0;
    if (estimated > scheduled) {
      futureCommitted += estimated - scheduled;
    }
  }

  return {
    cycleSpend,
    futureCommitted,
    committed: cycleSpend + futureCommitted,
  };
}

export function cardAvailableLimit(
  creditLimit: number | null | undefined,
  committed: number
): number | null {
  if (creditLimit == null) return null;
  return Math.max(0, Number(creditLimit) - committed);
}
