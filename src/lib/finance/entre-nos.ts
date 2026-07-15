/**
 * Acerto "Entre Nós": quem pagou (paid_by) vs dono do cartão/conta.
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
  paid_by_member_id: string | null;
  category?: { icon?: string | null; name?: string | null } | null;
  cards?: { owner_member_id?: string } | null;
  accounts?: { owner_member_id?: string } | null;
};

export type EntreNosSettlement = {
  balanced: boolean;
  debtor: { id: string; name: string; net: number } | null;
  creditor: { id: string; name: string; net: number } | null;
  netAmount: number;
  aPaidForB: number;
  bPaidForA: number;
  balances: { id: string; name: string; net: number }[];
  recent: {
    id: string;
    title: string;
    date: string;
    amount: number;
    payerName: string;
    ownerName: string;
  }[];
};

export function computeEntreNosSettlement(
  members: EntreNosMember[],
  txs: EntreNosTx[]
): EntreNosSettlement {
  const balances = new Map<string, number>();
  const pairFlow = new Map<string, number>();
  const recent: EntreNosSettlement["recent"] = [];
  const byId = new Map(members.map((m) => [m.id, m]));

  for (const m of members) balances.set(m.id, 0);

  for (const tx of txs) {
    const amount = Number(tx.amount);
    const payerId = tx.paid_by_member_id;
    const ownerId =
      tx.cards?.owner_member_id ?? tx.accounts?.owner_member_id ?? null;
    if (!payerId || !ownerId || payerId === ownerId) continue;

    balances.set(payerId, (balances.get(payerId) ?? 0) - amount);
    balances.set(ownerId, (balances.get(ownerId) ?? 0) + amount);

    const forward = `${ownerId}>${payerId}`;
    pairFlow.set(forward, (pairFlow.get(forward) ?? 0) + amount);

    recent.push({
      id: tx.id,
      title: tx.description,
      date: tx.transaction_date,
      amount,
      payerName: byId.get(payerId)?.display_name ?? "?",
      ownerName: byId.get(ownerId)?.display_name ?? "?",
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
  const aPaidForB = a && b ? pairFlow.get(`${a}>${b}`) ?? 0 : 0;
  const bPaidForA = a && b ? pairFlow.get(`${b}>${a}`) ?? 0 : 0;

  return {
    balanced: netAmount < 1,
    debtor,
    creditor,
    netAmount,
    aPaidForB,
    bPaidForA,
    balances: ranked,
    recent: recent.slice(0, 8),
  };
}
