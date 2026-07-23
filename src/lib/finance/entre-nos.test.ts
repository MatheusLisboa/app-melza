import { describe, expect, it } from "vitest";
import {
  computeEntreNosSettlement,
  resolveEntreNosPair,
  filterEntreNosTxsForMonth,
  filterEntreNosTxsByCard,
  txBelongsToEntreNosMonth,
  entreNosCardCycle,
  entreNosMonthQueryRange,
  enrichEntreNosTxsWithCards,
} from "@/lib/finance/entre-nos";
import { startOfMonth } from "@/lib/utils/format";

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

describe("filterEntreNosTxsForMonth — ciclo do cartão / vencimento", () => {
  it("sem due_day: compra após fechamento fica no mês do fechamento seguinte", () => {
    // Fecha 20, sem vencimento: 21/06 → fecha 20/07 → mês julho
    const purchase = {
      id: "1",
      amount: 100,
      description: "Após fechamento",
      transaction_date: "2026-06-21",
      paid_by_member_id: "b",
      consumer_member_id: "a",
      card: {
        owner_member_id: "b",
        name: "Nubank",
        closing_day: 20,
      },
    };

    const june = startOfMonth(new Date(2026, 5, 1));
    const july = startOfMonth(new Date(2026, 6, 1));

    expect(txBelongsToEntreNosMonth(purchase, june)).toBe(false);
    expect(txBelongsToEntreNosMonth(purchase, july)).toBe(true);
  });

  it("sem due_day: compra antes do fechamento fica no mês do fechamento", () => {
    const purchase = {
      id: "2",
      amount: 50,
      description: "Antes do fechamento",
      transaction_date: "2026-06-19",
      paid_by_member_id: "b",
      consumer_member_id: "a",
      card: {
        owner_member_id: "b",
        name: "Nubank",
        closing_day: 20,
      },
    };

    const june = startOfMonth(new Date(2026, 5, 1));
    const july = startOfMonth(new Date(2026, 6, 1));

    expect(txBelongsToEntreNosMonth(purchase, june)).toBe(true);
    expect(txBelongsToEntreNosMonth(purchase, july)).toBe(false);
  });

  it("fecha 24 e vence 10: compra 22/07 entra em agosto", () => {
    const purchase = {
      id: "22jul",
      amount: 200,
      description: "Compra antes do fechamento",
      transaction_date: "2026-07-22",
      paid_by_member_id: "b",
      consumer_member_id: "a",
      card: {
        owner_member_id: "b",
        name: "Cartão",
        closing_day: 24,
        due_day: 10,
      },
    };

    const july = startOfMonth(new Date(2026, 6, 1));
    const august = startOfMonth(new Date(2026, 7, 1));

    expect(txBelongsToEntreNosMonth(purchase, july)).toBe(false);
    expect(txBelongsToEntreNosMonth(purchase, august)).toBe(true);

    const cycle = entreNosCardCycle(august, 24, 10);
    expect(cycle?.from).toBe("2026-06-24");
    expect(cycle?.to).toBe("2026-07-23");
  });

  it("fecha 24 sem due_day: compra 22/07 fica em julho (não adianta tudo)", () => {
    const purchase = {
      id: "22jul-nodue",
      amount: 200,
      description: "Sem vencimento",
      transaction_date: "2026-07-22",
      paid_by_member_id: "b",
      consumer_member_id: "a",
      card: {
        owner_member_id: "b",
        name: "Cartão",
        closing_day: 24,
      },
    };

    const july = startOfMonth(new Date(2026, 6, 1));
    const august = startOfMonth(new Date(2026, 7, 1));

    expect(txBelongsToEntreNosMonth(purchase, july)).toBe(true);
    expect(txBelongsToEntreNosMonth(purchase, august)).toBe(false);
  });

  it("sem closing_day usa mês civil", () => {
    const purchase = {
      id: "3",
      amount: 30,
      description: "Débito",
      transaction_date: "2026-06-21",
      paid_by_member_id: "b",
      consumer_member_id: "a",
      account: { owner_member_id: "b", name: "Conta" },
    };

    const june = startOfMonth(new Date(2026, 5, 1));
    const july = startOfMonth(new Date(2026, 6, 1));

    expect(txBelongsToEntreNosMonth(purchase, june)).toBe(true);
    expect(txBelongsToEntreNosMonth(purchase, july)).toBe(false);
  });

  it("filtra por cartão e ignora acertos no filtro de cartão", () => {
    const txs = [
      {
        id: "1",
        amount: 100,
        description: "Card A",
        transaction_date: "2026-07-01",
        paid_by_member_id: "b",
        consumer_member_id: "a",
        card_id: "card-a",
        card: {
          id: "card-a",
          name: "Nubank",
          owner_member_id: "b",
          closing_day: 20,
        },
      },
      {
        id: "2",
        amount: 50,
        description: "Card B",
        transaction_date: "2026-07-02",
        paid_by_member_id: "b",
        consumer_member_id: "a",
        card_id: "card-b",
        card: {
          id: "card-b",
          name: "Inter",
          owner_member_id: "b",
          closing_day: 10,
        },
      },
      {
        id: "3",
        amount: 40,
        description: "Acerto",
        transaction_type: "settlement",
        transaction_date: "2026-07-05",
        paid_by_member_id: "a",
        consumer_member_id: "b",
      },
    ];

    expect(filterEntreNosTxsByCard(txs, "card-a")).toHaveLength(1);
    expect(filterEntreNosTxsByCard(txs, "all")).toHaveLength(3);
    expect(filterEntreNosTxsByCard(txs, "other")).toHaveLength(1);
  });

  it("ciclo julho sem due = compras do fechamento do próprio julho", () => {
    const july = startOfMonth(new Date(2026, 6, 1));
    const cycle = entreNosCardCycle(july, 20, null);
    expect(cycle).toMatchObject({
      from: "2026-06-20",
      to: "2026-07-19",
      key: "2026-07",
    });
  });

  it("parcela 2 (mês seguinte) entra no mês de pagamento correspondente", () => {
    const card = {
      owner_member_id: "b",
      name: "Cartão",
      closing_day: 24,
      due_day: 10,
    };
    const p1 = {
      id: "p1",
      amount: 100,
      description: "TV (1/3)",
      transaction_date: "2026-07-22",
      paid_by_member_id: "b",
      consumer_member_id: "a",
      card,
    };
    const p2 = {
      id: "p2",
      amount: 100,
      description: "TV (2/3)",
      transaction_date: "2026-08-22",
      paid_by_member_id: "b",
      consumer_member_id: "a",
      card,
    };

    const august = startOfMonth(new Date(2026, 7, 1));
    const september = startOfMonth(new Date(2026, 8, 1));

    expect(txBelongsToEntreNosMonth(p1, august)).toBe(true);
    expect(txBelongsToEntreNosMonth(p1, september)).toBe(false);
    expect(txBelongsToEntreNosMonth(p2, august)).toBe(false);
    expect(txBelongsToEntreNosMonth(p2, september)).toBe(true);
  });

  it("enrich preenche closing_day quando o embed veio incompleto", () => {
    const july = startOfMonth(new Date(2026, 6, 1));
    const august = startOfMonth(new Date(2026, 7, 1));
    const bare = {
      id: "1",
      amount: 50,
      description: "Sem meta",
      transaction_date: "2026-07-22",
      paid_by_member_id: "b",
      consumer_member_id: "a",
      card_id: "c1",
      card: { id: "c1", name: "Nubank", owner_member_id: "b" },
    };

    // Sem closing_day → mês civil (julho)
    expect(txBelongsToEntreNosMonth(bare, july)).toBe(true);

    const enriched = enrichEntreNosTxsWithCards([bare], [
      {
        id: "c1",
        name: "Nubank",
        owner_member_id: "b",
        closing_day: 24,
        due_day: 10,
      },
    ]);

    expect(txBelongsToEntreNosMonth(enriched[0]!, july)).toBe(false);
    expect(txBelongsToEntreNosMonth(enriched[0]!, august)).toBe(true);
  });

  it("query range cobre 4 meses atrás", () => {
    const august = startOfMonth(new Date(2026, 7, 1));
    expect(entreNosMonthQueryRange(august)).toEqual({
      from: "2026-04-01",
      to: "2026-08-31",
    });
  });
});

describe("computeEntreNosSettlement", () => {
  it("mostra dívida quando esposa consumiu e marido pagou no cartão", () => {
    const settlement = computeEntreNosSettlement(
      members,
      [
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
      ],
      { month: startOfMonth(new Date(2026, 6, 1)) }
    );

    expect(settlement.balanced).toBe(false);
    expect(settlement.debtor?.id).toBe("b");
    expect(settlement.creditor?.id).toBe("a");
    expect(settlement.netAmount).toBe(120);
    expect(settlement.bPaidForA).toBe(120);
    expect(settlement.recent[0]?.cardName).toBe("Nubank");
    expect(settlement.recent[0]?.consumerId).toBe("b");
    expect(settlement.recent[0]?.payerId).toBe("a");
    expect(settlement.recent[0]?.isSettlement).toBe(false);
    expect(settlement.byCard).toHaveLength(1);
    expect(settlement.byCard[0]?.netAmount).toBe(120);
    expect(settlement.balances.find((b) => b.id === "b")?.net).toBe(-120);
    expect(settlement.balances.find((b) => b.id === "a")?.net).toBe(120);
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

  it("rateio 50/50 reduz a dívida pela metade e expõe as duas partes", () => {
    const settlement = computeEntreNosSettlement(members, [
      {
        id: "tx1",
        amount: 200,
        description: "Jantar",
        transaction_date: "2026-07-01",
        paid_by_member_id: "b",
        consumer_member_id: "a",
        consumer_share_percent: 50,
        card: {
          id: "c1",
          name: "Nubank",
          owner_member_id: "b",
          closing_day: 5,
        },
      },
    ]);
    expect(settlement.netAmount).toBe(100);
    expect(settlement.recent[0]?.sharePercent).toBe(50);
    expect(settlement.recent[0]?.isSplit).toBe(true);
    expect(settlement.recent[0]?.consumerShareAmount).toBe(100);
    expect(settlement.recent[0]?.otherShareAmount).toBe(100);
    expect(settlement.recent[0]?.otherSharePercent).toBe(50);
  });
});
