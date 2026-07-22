/**
 * Acerto "Entre Nós": quem consumiu vs quem pagou / dono do cartão.
 * Settlements (acerto) usam a mesma matemática e reduzem o saldo.
 */

export type EntreNosMember = {
  id: string;
  display_name: string;
};

type Instrument = {
  id?: string;
  name?: string | null;
  owner_member_id?: string | null;
} | null;

export type EntreNosTx = {
  id: string;
  amount: number;
  description: string;
  transaction_date: string;
  transaction_type?: string | null;
  paid_by_member_id: string | null;
  consumer_member_id?: string | null;
  category?: { icon?: string | null; name?: string | null } | null;
  /** PostgREST: objeto, array ou aliases card/account */
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
  consumerId: string;
  consumerName: string;
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
  aPaidForB: number;
  bPaidForA: number;
  settledAmount: number;
  balances: { id: string; name: string; net: number }[];
  recent: EntreNosRecentItem[];
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

/**
 * Resolve o par (devedor, credor) de um lançamento, ou null se não gera dívida.
 *
 * Prioridade:
 * 1. consumer ≠ paid_by → consumer deve a paid_by
 * 2. consumer ≠ dono do cartão/conta → consumer deve ao dono (usou cartão de outro)
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

  // Caso comum: eu consumi no cartão dela, e "quem pagou" ficou como eu
  if (consumerId && ownerId && consumerId !== ownerId) {
    return { consumerId, payerId: ownerId };
  }

  if (paidById && ownerId && paidById !== ownerId) {
    return { consumerId: paidById, payerId: ownerId };
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
    const card = getTxCard(tx);
    const account = getTxAccount(tx);

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
      cardName: card?.name ?? null,
      accountName: account?.name ?? null,
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
    balances: ranked,
    recent,
  };
}
