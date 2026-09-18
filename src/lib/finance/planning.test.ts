import { describe, expect, it } from "vitest";
import { matchCategorizationRule } from "./categorize-rules";
import { projectMonth, yearMonthOf } from "./month-projection";

describe("matchCategorizationRule", () => {
  const rules = [
    { pattern: "iFood", category_id: "food" },
    { pattern: "uber", category_id: "transport" },
  ];

  it("casa descrição com padrão", () => {
    expect(matchCategorizationRule("IFOOD #123", rules)).toBe("food");
  });

  it("ignora padrão curto e vazio", () => {
    expect(
      matchCategorizationRule("x", [{ pattern: "x", category_id: "a" }])
    ).toBe(null);
    expect(matchCategorizationRule("", rules)).toBe(null);
  });

  it("usa a primeira regra que casar", () => {
    expect(matchCategorizationRule("uber eats ifood", rules)).toBe("food");
    expect(
      matchCategorizationRule("uber viagem", [
        { pattern: "uber eats", category_id: "food" },
        { pattern: "uber", category_id: "transport" },
      ])
    ).toBe("transport");
  });
});

describe("projectMonth", () => {
  it("desconta faturas e assinaturas, soma salário", () => {
    const out = projectMonth({
      balance: 2000,
      invoiceRemaining: 400,
      fromISO: "2026-09-01",
      untilISO: "2026-09-30",
      recurrings: [
        {
          amount: 55,
          kind: "expense",
          next_billing_date: "2026-09-20",
          is_active: true,
        },
        {
          amount: 3000,
          kind: "income",
          next_billing_date: "2026-09-05",
          is_active: true,
        },
        {
          amount: 99,
          kind: "expense",
          next_billing_date: "2026-10-02",
          is_active: true,
        },
      ],
    });
    expect(out.billsLeft).toBe(455);
    expect(out.incomeLeft).toBe(3000);
    expect(out.leftover).toBe(4545);
  });
});

describe("yearMonthOf", () => {
  it("formata AAAA-MM", () => {
    expect(yearMonthOf(new Date(2026, 8, 17))).toBe("2026-09");
  });
});
