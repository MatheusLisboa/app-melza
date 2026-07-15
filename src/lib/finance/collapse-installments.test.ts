import { describe, expect, it } from "vitest";
import {
  collapseInstallmentPurchases,
  stripInstallmentSuffix,
} from "./collapse-installments";

describe("stripInstallmentSuffix", () => {
  it("remove (n/total)", () => {
    expect(stripInstallmentSuffix("iPhone (3/12)")).toBe("iPhone");
  });
});

describe("collapseInstallmentPurchases", () => {
  it("mantém só a 1ª parcela com valor total", () => {
    const rows = collapseInstallmentPurchases([
      {
        id: "a",
        description: "Loja (1/3)",
        amount: 100,
        is_installment: true,
        installment_number: 1,
        total_installments: 3,
        installment_group_id: "g1",
        transaction_date: "2026-01-01",
      },
      {
        id: "b",
        description: "Loja (2/3)",
        amount: 100,
        is_installment: true,
        installment_number: 2,
        total_installments: 3,
        installment_group_id: "g1",
        transaction_date: "2026-02-01",
      },
      {
        id: "c",
        description: "Almoço",
        amount: 40,
        is_installment: false,
        installment_number: null,
        total_installments: null,
        installment_group_id: null,
        transaction_date: "2026-01-02",
      },
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0].id).toBe("a");
    expect(rows[0].displayDescription).toBe("Loja");
    expect(rows[0].displayAmount).toBe(300);
    expect(rows[0].purchaseInstallments).toBe(3);
    expect(rows[1].id).toBe("c");
    expect(rows[1].displayAmount).toBe(40);
  });
});
