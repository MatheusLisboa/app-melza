/**
 * Acerto "Entre Nós": quem consumiu vs quem pagou / dono do cartão.
 * Rateio: consumer_share_percent (ex. 50 = metade do valor).
 *
 * Mês do cartão = mês do *vencimento* da fatura:
 * - due_day > closing_day → vence no mês do fechamento
 * - due_day ≤ closing_day → vence no mês seguinte
 * - sem due_day → usa o mês do fechamento (não adianta tudo)
 * Conta / acerto: mês civil da data.
 */

import { buildInvoiceCycle } from "@/lib/utils/invoice-cycle";
import {
  addMonths,
  endOfMonth,
  formatDate,
  startOfMonth,
  toISODate,
} from "@/lib/utils/format";

export type EntreNosMember = {
  id: string;
  display_name: string;
};

type Instrument = {
  id?: string;
  name?: string | null;
  owner_member_id?: string | null;
  closing_day?: number | null;
  due_day?: number | null;
} | null;

/** "all" | "other" (sem cartão) | id do cartão */
export type EntreNosCardFilter = "all" | "other" | (string & {});

/** Select embutido de cartão/conta para queries Entre Nós. */
export const ENTRE_NOS_TX_SELECT = `
  id, amount, description, transaction_type, paid_by_member_id,
  consumer_member_id, consumer_share_percent, transaction_date, card_id,
  category:categories(icon, name),
  card:cards!card_id(id, name, owner_member_id, closing_day, due_day),
  account:accounts!account_id(id, name, owner_member_id)
`;

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function clampDay(year: number, month: number, day: number): Date {
  const last = endOfMonth(new Date(year, month, 1)).getDate();
  return new Date(year, month, Math.min(day, last));
}

function normalizeDueDay(
  dueDay: number | null | undefined
): number | null {
  if (typeof dueDay !== "number" || dueDay < 1 || dueDay > 31) return null;
  return dueDay;
}

function normalizeClosingDay(
  closingDay: number | null | undefined
): number | null {
  if (typeof closingDay !== "number" || closingDay < 1 || closingDay > 31) {
    return null;
  }
  return closingDay;
}

/**
 * Data de fechamento do ciclo que contém a compra.
 * No dia D (00:01) a compra já cai no ciclo seguinte.
 */
export function closingDateForPurchase(
  purchaseISO: string,
  closingDay: number
): Date {
  const [y, m, d] = purchaseISO.split("-").map(Number);
  const purchaseMonth = m - 1;
  if (d < closingDay) {
    return clampDay(y, purchaseMonth, closingDay);
  }
  const next = addMonths(new Date(y, purchaseMonth, 1), 1);
  return clampDay(next.getFullYear(), next.getMonth(), closingDay);
}

/**
 * Vencimento vence no mês seguinte ao fechamento?
 * (ex.: fecha 24, vence 10 → sim; fecha 5, vence 12 → não)
 */
export function dueFallsNextMonth(
  closingDay: number,
  dueDay: number | null | undefined
): boolean {
  const due = normalizeDueDay(dueDay);
  if (due == null) return false;
  return due <= closingDay;
}

/**
 * Mês do Entre Nós para a fatura que fecha em `closingDate`.
 * Sem due_day → mês do fechamento (não desloca o calendário inteiro).
 */
export function paymentMonthForClosing(
  closingDate: Date,
  closingDay: number,
  dueDay?: number | null
): Date {
  if (dueFallsNextMonth(closingDay, dueDay)) {
    return startOfMonth(addMonths(closingDate, 1));
  }
  return startOfMonth(closingDate);
}

export function paymentMonthForPurchase(
  purchaseISO: string,
  closingDay: number,
  dueDay?: number | null
): Date {
  return paymentMonthForClosing(
    closingDateForPurchase(purchaseISO, closingDay),
    closingDay,
    dueDay
  );
}

/** Janela de fetch: cobre ciclo que pode ter fechado no mês anterior. */
export function entreNosMonthQueryRange(month: Date): {
  from: string;
  to: string;
} {
  return {
    from: toISODate(startOfMonth(addMonths(month, -2))),
    to: toISODate(endOfMonth(month)),
  };
}

/**
 * Ciclo de compras da fatura cujo vencimento cai no mês selecionado.
 */
export function entreNosCardCycle(
  paymentMonth: Date,
  closingDay: number | null | undefined,
  dueDay?: number | null
): {
  from: string;
  to: string;
  key: string;
  closingDay: number;
  dueDay: number | null;
} | null {
  const close = normalizeClosingDay(closingDay);
  if (close == null) return null;

  const closingMonthDate = dueFallsNextMonth(close, dueDay)
    ? addMonths(paymentMonth, -1)
    : paymentMonth;

  const due = normalizeDueDay(dueDay);
  const cycle = buildInvoiceCycle(
    closingMonthDate.getFullYear(),
    closingMonthDate.getMonth(),
    close,
    due
  );
  return {
    from: cycle.from,
    to: cycle.to,
    key: monthKey(paymentMonth),
    closingDay: close,
    dueDay: due,
  };
}

export function formatEntreNosCycleRange(
  from: string,
  to: string
): string {
  return `${formatDate(from)} — ${formatDate(to)}`;
}

/**
 * Cartão com closing_day → mês do vencimento (ou do fechamento se sem due).
 * Sem cartão / sem fechamento / acerto → mês civil.
 */
export function txBelongsToEntreNosMonth(
  tx: EntreNosTx,
  month: Date
): boolean {
  const calFrom = toISODate(startOfMonth(month));
  const calTo = toISODate(endOfMonth(month));
  const selectedKey = monthKey(month);

  if (tx.transaction_type === "settlement") {
    return tx.transaction_date >= calFrom && tx.transaction_date <= calTo;
  }

  const card = getTxCard(tx);
  const closingDay = normalizeClosingDay(card?.closing_day);
  if (closingDay != null) {
    return (
      monthKey(
        paymentMonthForPurchase(
          tx.transaction_date,
          closingDay,
          card?.due_day
        )
      ) === selectedKey
    );
  }

  return tx.transaction_date >= calFrom && tx.transaction_date <= calTo;
}

export function filterEntreNosTxsForMonth(
  txs: EntreNosTx[],
  month: Date
): EntreNosTx[] {
  return txs.filter((tx) => txBelongsToEntreNosMonth(tx, month));
}

export function filterEntreNosTxsByCard(
  txs: EntreNosTx[],
  filter: EntreNosCardFilter
): EntreNosTx[] {
  if (filter === "all") return txs;

  if (filter === "other") {
    return txs.filter((tx) => {
      if (tx.transaction_type === "settlement") return true;
      return !getTxCard(tx)?.id && !tx.card_id;
    });
  }

  return txs.filter((tx) => {
    if (tx.transaction_type === "settlement") return false;
    const card = getTxCard(tx);
    return (card?.id ?? tx.card_id) === filter;
  });
}

export type EntreNosTx = {
  id: string;
  amount: number;
  description: string;
  transaction_date: string;
  transaction_type?: string | null;
  paid_by_member_id: string | null;
  consumer_member_id?: string | null;
  card_id?: string | null;
  /** 1–100; default 100 */
  consumer_share_percent?: number | null;
  category?: { icon?: string | null; name?: string | null } | null;
  cards?: Instrument | Instrument[];
  accounts?: Instrument | Instrument[];
  card?: Instrument;
  account?: Instrument;
};

export type EntreNosRecentItem = {
  id: string;
  title: string;
  date: string;
  amount: number;
  /** Valor bruto do lançamento (antes do rateio) */
  grossAmount: number;
  /** Parte de quem consumiu (dívida Entre Nós) */
  consumerShareAmount: number;
  /** Parte de quem fica com o cartão / o outro no rateio */
  otherShareAmount: number;
  sharePercent: number;
  otherSharePercent: number;
  isSplit: boolean;
  consumerId: string;
  consumerName: string;
  payerId: string;
  payerName: string;
  cardId: string | null;
  cardName: string | null;
  closingDay: number | null;
  dueDay: number | null;
  accountName: string | null;
  categoryIcon: string | null;
  isSettlement: boolean;
};

export type EntreNosMemberBalance = {
  id: string;
  name: string;
  /** Negativo = deve; positivo = a receber */
  net: number;
};

export type EntreNosCardBreakdown = {
  cardId: string;
  cardName: string;
  closingDay: number | null;
  cycleFrom: string | null;
  cycleTo: string | null;
  balances: EntreNosMemberBalance[];
  debtor: EntreNosMemberBalance | null;
  creditor: EntreNosMemberBalance | null;
  netAmount: number;
  expenseCount: number;
};

export type EntreNosSettlement = {
  balanced: boolean;
  debtor: EntreNosMemberBalance | null;
  creditor: EntreNosMemberBalance | null;
  netAmount: number;
  aPaidForB: number;
  bPaidForA: number;
  settledAmount: number;
  /** Data do gasto aberto mais antigo (para lembrete) */
  oldestOpenDate: string | null;
  balances: EntreNosMemberBalance[];
  recent: EntreNosRecentItem[];
  byCard: EntreNosCardBreakdown[];
};

function asInstrument(
  value: Instrument | Instrument[] | undefined
): Instrument {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

export function getTxCard(tx: EntreNosTx): Instrument {
  return asInstrument(tx.card) ?? asInstrument(tx.cards);
}

export function getTxAccount(tx: EntreNosTx): Instrument {
  return asInstrument(tx.account) ?? asInstrument(tx.accounts);
}

export function debtAmountForTx(tx: EntreNosTx): number {
  const gross = Number(tx.amount);
  if (!Number.isFinite(gross) || gross <= 0) return 0;
  if (tx.transaction_type === "settlement") return gross;
  const pct = Number(tx.consumer_share_percent ?? 100);
  const share = Math.min(100, Math.max(1, Number.isFinite(pct) ? pct : 100));
  return Math.round(gross * share) / 100;
}

/**
 * Prioridade:
 * 1. consumer ≠ paid_by → consumer deve a paid_by
 * 2. consumer ≠ dono do cartão/conta → consumer deve ao dono
 * 3. paid_by ≠ dono → paid_by deve ao dono
 */
export function resolveEntreNosPair(tx: EntreNosTx): {
  consumerId: string;
  payerId: string;
} | null {
  const paidById = tx.paid_by_member_id;
  const consumerId = tx.consumer_member_id ?? null;
  const card = getTxCard(tx);
  const account = getTxAccount(tx);
  const ownerId = card?.owner_member_id ?? account?.owner_member_id ?? null;

  if (consumerId && paidById && consumerId !== paidById) {
    return { consumerId, payerId: paidById };
  }

  if (tx.transaction_type === "settlement") return null;

  if (consumerId && ownerId && consumerId !== ownerId) {
    return { consumerId, payerId: ownerId };
  }

  if (paidById && ownerId && paidById !== ownerId) {
    return { consumerId: paidById, payerId: ownerId };
  }

  return null;
}

function rankedBalances(
  balances: Map<string, number>,
  byId: Map<string, EntreNosMember>
): EntreNosMemberBalance[] {
  return Array.from(balances.entries())
    .map(([id, net]) => ({
      id,
      name: byId.get(id)?.display_name ?? id,
      net: Math.round(net * 100) / 100,
    }))
    .sort((a, b) => a.net - b.net);
}

function pickDebtorCreditor(ranked: EntreNosMemberBalance[]): {
  debtor: EntreNosMemberBalance | null;
  creditor: EntreNosMemberBalance | null;
  netAmount: number;
} {
  const debtor = ranked.find((r) => r.net < -1) ?? null;
  const creditor = [...ranked].reverse().find((r) => r.net > 1) ?? null;
  const netAmount =
    debtor && creditor
      ? Math.min(Math.abs(debtor.net), Math.abs(creditor.net))
      : 0;
  return { debtor, creditor, netAmount };
}

function buildCardBreakdowns(
  members: EntreNosMember[],
  recent: EntreNosRecentItem[],
  month: Date | null
): EntreNosCardBreakdown[] {
  const byId = new Map(members.map((m) => [m.id, m]));
  const groups = new Map<
    string,
    {
      cardName: string;
      closingDay: number | null;
      dueDay: number | null;
      balances: Map<string, number>;
      count: number;
    }
  >();

  for (const item of recent) {
    if (item.isSettlement || !item.cardId) continue;
    let g = groups.get(item.cardId);
    if (!g) {
      g = {
        cardName: item.cardName ?? "Cartão",
        closingDay: item.closingDay,
        dueDay: item.dueDay,
        balances: new Map(members.map((m) => [m.id, 0])),
        count: 0,
      };
      groups.set(item.cardId, g);
    }
    g.count += 1;
    g.balances.set(
      item.consumerId,
      (g.balances.get(item.consumerId) ?? 0) - item.amount
    );
    g.balances.set(
      item.payerId,
      (g.balances.get(item.payerId) ?? 0) + item.amount
    );
  }

  return Array.from(groups.entries())
    .map(([cardId, g]) => {
      const balances = rankedBalances(g.balances, byId);
      const { debtor, creditor, netAmount } = pickDebtorCreditor(balances);
      const cycle = month
        ? entreNosCardCycle(month, g.closingDay, g.dueDay)
        : null;
      return {
        cardId,
        cardName: g.cardName,
        closingDay: g.closingDay,
        cycleFrom: cycle?.from ?? null,
        cycleTo: cycle?.to ?? null,
        balances,
        debtor,
        creditor,
        netAmount,
        expenseCount: g.count,
      };
    })
    .sort((a, b) => b.netAmount - a.netAmount);
}

export function computeEntreNosSettlement(
  members: EntreNosMember[],
  txs: EntreNosTx[],
  opts?: { month?: Date | null }
): EntreNosSettlement {
  const balances = new Map<string, number>();
  const expenseFlow = new Map<string, number>();
  const settlementFlow = new Map<string, number>();
  const recent: EntreNosRecentItem[] = [];
  const byId = new Map(members.map((m) => [m.id, m]));
  let oldestOpenDate: string | null = null;

  for (const m of members) balances.set(m.id, 0);

  for (const tx of txs) {
    const amount = debtAmountForTx(tx);
    if (amount <= 0) continue;

    const pair = resolveEntreNosPair(tx);
    if (!pair) continue;

    const { consumerId, payerId } = pair;
    const isSettlement = tx.transaction_type === "settlement";
    const card = getTxCard(tx);
    const account = getTxAccount(tx);
    const sharePercent = isSettlement
      ? 100
      : Math.min(100, Math.max(1, Number(tx.consumer_share_percent ?? 100)));
    const grossAmount = Number(tx.amount);
    const otherSharePercent = isSettlement ? 0 : 100 - sharePercent;
    const otherShareAmount = isSettlement
      ? 0
      : Math.round((grossAmount - amount) * 100) / 100;

    balances.set(consumerId, (balances.get(consumerId) ?? 0) - amount);
    balances.set(payerId, (balances.get(payerId) ?? 0) + amount);

    const forward = `${consumerId}>${payerId}`;
    if (isSettlement) {
      settlementFlow.set(forward, (settlementFlow.get(forward) ?? 0) + amount);
    } else {
      expenseFlow.set(forward, (expenseFlow.get(forward) ?? 0) + amount);
      if (!oldestOpenDate || tx.transaction_date < oldestOpenDate) {
        oldestOpenDate = tx.transaction_date;
      }
    }

    recent.push({
      id: tx.id,
      title: tx.description,
      date: tx.transaction_date,
      amount,
      grossAmount,
      consumerShareAmount: amount,
      otherShareAmount,
      sharePercent,
      otherSharePercent,
      isSplit: !isSettlement && sharePercent < 100,
      consumerId,
      consumerName: byId.get(consumerId)?.display_name ?? "?",
      payerId,
      payerName: byId.get(payerId)?.display_name ?? "?",
      cardId: card?.id ?? tx.card_id ?? null,
      cardName: card?.name ?? null,
      closingDay:
        typeof card?.closing_day === "number" ? card.closing_day : null,
      dueDay: typeof card?.due_day === "number" ? card.due_day : null,
      accountName: account?.name ?? null,
      categoryIcon: isSettlement ? "🤝" : (tx.category?.icon ?? null),
      isSettlement,
    });
  }

  const ranked = rankedBalances(balances, byId);
  const { debtor, creditor, netAmount } = pickDebtorCreditor(ranked);

  const a = debtor?.id;
  const b = creditor?.id;
  const bPaidForA = a && b ? expenseFlow.get(`${a}>${b}`) ?? 0 : 0;
  const aPaidForB = a && b ? expenseFlow.get(`${b}>${a}`) ?? 0 : 0;
  const settledAmount =
    a && b
      ? (settlementFlow.get(`${b}>${a}`) ?? 0) +
        (settlementFlow.get(`${a}>${b}`) ?? 0)
      : Array.from(settlementFlow.values()).reduce((s, n) => s + n, 0);

  return {
    balanced: netAmount < 1,
    debtor,
    creditor,
    netAmount,
    aPaidForB,
    bPaidForA,
    settledAmount,
    oldestOpenDate: netAmount >= 1 ? oldestOpenDate : null,
    balances: ranked,
    recent,
    byCard: buildCardBreakdowns(members, recent, opts?.month ?? null),
  };
}
