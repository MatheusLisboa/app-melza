/**
 * Acerto "Entre Nós": quem consumiu vs quem pagou.
 * Fallback: quem pagou com cartão/conta de outra pessoa.
 * Settlements (acerto) usam a mesma matemática e reduzem o saldo.
 */

export type EntreNosMember = {
  id: string;
  display_name: string;
};

export type EntreNosTx = {
  id: string;
  amount: number;
  description: string;
  transaction_date: string;
  transaction_type?: string | null;
  paid_by_member_id: string | null;
  consumer_member_id?: string | null;
  category?: { icon?: string | null; name?: string | null } | null;
  cards?: {
    id?: string;
    name?: string | null;
    owner_member_id?: string | null;
  } | null;
  accounts?: {
    id?: string;
    name?: string | null;
    owner_member_id?: string | null;
  } | null;
};

export type EntreNosRecentItem = {
  id: string;
  title: string;
  date: string;
  amount: number;
  /** Quem ficou devendo neste lançamento (ou quem recebeu o acerto) */
  consumerId: string;
  consumerName: string;
  /** Quem adiantou / pagou (ou quem quitou no acerto) */
  payerId: string;
  payerName: string;
  cardName: string | null;
  accountName: string | null;
  categoryIcon: string | null;
  isSettlement: boolean;
};

export type EntreNosSettlement = {
  balanced: boolean;
  debtor: { id: string; name: string; net: number } | null;
  creditor: { id: string; name: string; net: number } | null;
  netAmount: number;
  /** Gastos: credor pagou por devedor */
  aPaidForB: number;
  bPaidForA: number;
  /** Soma dos acertos já registrados entre o par */
  settledAmount: number;
  balances: { id: string; name: string; net: number }[];
  recent: EntreNosRecentItem[];
};

/** Resolve o par (devedor, credor) de um lançamento, ou null se não gera dívida. */
export function resolveEntreNosPair(tx: EntreNosTx): {
  consumerId: string;
  payerId: string;
} | null {
  const payerId = tx.paid_by_member_id;
  if (!payerId) return null;

  const consumerId = tx.consumer_member_id ?? null;
  if (consumerId && consumerId !== payerId) {
    return { consumerId, payerId };
  }

  // Settlement sem consumer inválido
  if (tx.transaction_type === "settlement") return null;

  // Fallback: pagou com cartão/conta de outra pessoa → quem pagou deve ao dono
  const ownerId =
    tx.cards?.owner_member_id ?? tx.accounts?.owner_member_id ?? null;
  if (ownerId && payerId !== ownerId) {
    return { consumerId: payerId, payerId: ownerId };
  }

  return null;
}

export function computeEntreNosSettlement(
  members: EntreNosMember[],
  txs: EntreNosTx[]
): EntreNosSettlement {
  const balances = new Map<string, number>();
  const expenseFlow = new Map<string, number>();
  const settlementFlow = new Map<string, number>();
  const recent: EntreNosRecentItem[] = [];
  const byId = new Map(members.map((m) => [m.id, m]));

  for (const m of members) balances.set(m.id, 0);

  for (const tx of txs) {
    const amount = Number(tx.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;

    const pair = resolveEntreNosPair(tx);
    if (!pair) continue;

    const { consumerId, payerId } = pair;
    const isSettlement = tx.transaction_type === "settlement";

    // Consumidor deve; quem pagou tem crédito (acerto: quem recebe “consome” o crédito)
    balances.set(consumerId, (balances.get(consumerId) ?? 0) - amount);
    balances.set(payerId, (balances.get(payerId) ?? 0) + amount);

    const forward = `${consumerId}>${payerId}`;
    if (isSettlement) {
      settlementFlow.set(forward, (settlementFlow.get(forward) ?? 0) + amount);
    } else {
      expenseFlow.set(forward, (expenseFlow.get(forward) ?? 0) + amount);
    }

    recent.push({
      id: tx.id,
      title: tx.description,
      date: tx.transaction_date,
      amount,
      consumerId,
      consumerName: byId.get(consumerId)?.display_name ?? "?",
      payerId,
      payerName: byId.get(payerId)?.display_name ?? "?",
      cardName: tx.cards?.name ?? null,
      accountName: tx.accounts?.name ?? null,
      categoryIcon: isSettlement ? "🤝" : (tx.category?.icon ?? null),
      isSettlement,
    });
  }

  const ranked = Array.from(balances.entries())
    .map(([id, net]) => ({
      id,
      name: byId.get(id)?.display_name ?? id,
      net,
    }))
    .sort((a, b) => a.net - b.net);

  const debtor = ranked.find((r) => r.net < -1) ?? null;
  const creditor = [...ranked].reverse().find((r) => r.net > 1) ?? null;
  const netAmount =
    debtor && creditor
      ? Math.min(Math.abs(debtor.net), Math.abs(creditor.net))
      : 0;

  const a = debtor?.id;
  const b = creditor?.id;
  // Gastos: B pagou por A / A pagou por B
  const bPaidForA = a && b ? expenseFlow.get(`${a}>${b}`) ?? 0 : 0;
  const aPaidForB = a && b ? expenseFlow.get(`${b}>${a}`) ?? 0 : 0;
  // Acertos: A pagou B → consumer=B, payer=A → key b>a
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
    balances: ranked,
    recent,
  };
}
