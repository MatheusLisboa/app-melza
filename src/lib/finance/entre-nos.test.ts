import { describe, expect, it } from "vitest";
import {
  computeEntreNosSettlement,
  resolveEntreNosPair,
} from "@/lib/finance/entre-nos";

const members = [
  { id: "a", display_name: "Matheus" },
  { id: "b", display_name: "Esposa" },
];

describe("resolveEntreNosPair", () => {
  it("usa consumer vs payer quando diferem", () => {
    expect(
      resolveEntreNosPair({
        id: "1",
        amount: 100,
        description: "Mercado",
        transaction_date: "2026-01-01",
        paid_by_member_id: "a",
        consumer_member_id: "b",
        cards: { owner_member_id: "a", name: "Nubank" },
      })
    ).toEqual({ consumerId: "b", payerId: "a" });
  });

  it("ignora quando consumer === payer", () => {
    expect(
      resolveEntreNosPair({
        id: "1",
        amount: 50,
        description: "Café",
        transaction_date: "2026-01-01",
        paid_by_member_id: "a",
        consumer_member_id: "a",
        cards: { owner_member_id: "a", name: "Nubank" },
      })
    ).toBeNull();
  });

  it("fallback: pagou com cartão de outra pessoa", () => {
    expect(
      resolveEntreNosPair({
        id: "1",
        amount: 80,
        description: "Uber",
        transaction_date: "2026-01-01",
        paid_by_member_id: "b",
        consumer_member_id: null,
        cards: { owner_member_id: "a", name: "Visa" },
      })
    ).toEqual({ consumerId: "b", payerId: "a" });
  });

  it("consumer no cartão de outro mesmo com paid_by = consumer", () => {
    expect(
      resolveEntreNosPair({
        id: "1",
        amount: 100,
        description: "Mercado",
        transaction_date: "2026-07-22",
        paid_by_member_id: "a",
        consumer_member_id: "a",
        card: { owner_member_id: "b", name: "Nubank dela" },
      })
    ).toEqual({ consumerId: "a", payerId: "b" });
  });
});

describe("computeEntreNosSettlement", () => {
  it("mostra dívida quando esposa consumiu e marido pagou no cartão", () => {
    const settlement = computeEntreNosSettlement(members, [
      {
        id: "tx1",
        amount: 120,
        description: "Farmácia",
        transaction_date: "2026-07-01",
        paid_by_member_id: "a",
        consumer_member_id: "b",
        cards: { id: "c1", name: "Nubank", owner_member_id: "a" },
        category: { icon: "💊", name: "Saúde" },
      },
    ]);

    expect(settlement.balanced).toBe(false);
    expect(settlement.debtor?.id).toBe("b");
    expect(settlement.creditor?.id).toBe("a");
    expect(settlement.netAmount).toBe(120);
    expect(settlement.bPaidForA).toBe(120);
    expect(settlement.recent[0]?.cardName).toBe("Nubank");
    expect(settlement.recent[0]?.consumerId).toBe("b");
    expect(settlement.recent[0]?.payerId).toBe("a");
    expect(settlement.recent[0]?.isSettlement).toBe(false);
  });

  it("fica balanceado quando cada um pagou o próprio consumo", () => {
    const settlement = computeEntreNosSettlement(members, [
      {
        id: "tx1",
        amount: 40,
        description: "Almoço",
        transaction_date: "2026-07-01",
        paid_by_member_id: "a",
        consumer_member_id: "a",
      },
      {
        id: "tx2",
        amount: 40,
        description: "Jantar",
        transaction_date: "2026-07-02",
        paid_by_member_id: "b",
        consumer_member_id: "b",
      },
    ]);

    expect(settlement.balanced).toBe(true);
    expect(settlement.recent).toHaveLength(0);
  });

  it("acerto parcial reduz o saldo e acerto total zera", () => {
    const base = [
      {
        id: "tx1",
        amount: 1000,
        description: "Compras no cartão",
        transaction_date: "2026-07-01",
        paid_by_member_id: "b",
        consumer_member_id: "a",
        cards: { name: "Nubank", owner_member_id: "b" },
      },
    ];

    const partial = computeEntreNosSettlement(members, [
      ...base,
      {
        id: "s1",
        amount: 400,
        description: "Acerto parcial",
        transaction_date: "2026-07-10",
        transaction_type: "settlement",
        paid_by_member_id: "a",
        consumer_member_id: "b",
      },
    ]);
    expect(partial.balanced).toBe(false);
    expect(partial.debtor?.id).toBe("a");
    expect(partial.netAmount).toBe(600);
    expect(partial.settledAmount).toBe(400);

    const full = computeEntreNosSettlement(members, [
      ...base,
      {
        id: "s1",
        amount: 400,
        description: "Acerto parcial",
        transaction_date: "2026-07-10",
        transaction_type: "settlement",
        paid_by_member_id: "a",
        consumer_member_id: "b",
      },
      {
        id: "s2",
        amount: 600,
        description: "Acerto final",
        transaction_date: "2026-07-15",
        transaction_type: "settlement",
        paid_by_member_id: "a",
        consumer_member_id: "b",
      },
    ]);
    expect(full.balanced).toBe(true);
    expect(full.netAmount).toBe(0);
    expect(full.settledAmount).toBe(1000);
  });
});
