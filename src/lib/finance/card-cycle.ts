import type { Card } from "@/types";
import {
  defaultCycleKey,
  listInvoiceCycles,
  type InvoiceCycle,
} from "@/lib/utils/invoice-cycle";

export function getCurrentInvoiceCycle(
  card: Pick<Card, "closing_day" | "due_day">,
  today = new Date()
): InvoiceCycle | null {
  const cycles = listInvoiceCycles(card.closing_day, card.due_day, 4, today);
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

export function cardAvailableLimit(
  creditLimit: number | null | undefined,
  usedInCycle: number
): number | null {
  if (creditLimit == null) return null;
  return Math.max(0, Number(creditLimit) - usedInCycle);
}
