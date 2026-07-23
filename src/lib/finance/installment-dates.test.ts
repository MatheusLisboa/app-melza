import { describe, expect, it } from "vitest";
import { dateForInstallmentInSeries } from "@/lib/finance/installment-dates";
import { addMonths, toISODate } from "@/lib/utils/format";
import {
  paymentMonthForPurchase,
  txBelongsToEntreNosMonth,
} from "@/lib/finance/entre-nos";
import { startOfMonth } from "@/lib/utils/format";

describe("addMonths seguro", () => {
  it("não pula fevereiro a partir de 31/jan", () => {
    const jan31 = new Date(2026, 0, 31, 12);
    const feb = addMonths(jan31, 1);
    expect(toISODate(feb)).toBe("2026-02-28");
  });
});

describe("dateForInstallmentInSeries", () => {
  it("com ciclo fecha 24 vence 10: parcelas em meses de pagamento consecutivos", () => {
    // Compra 22/07 → pagamento agosto; 2ª → setembro; 3ª → outubro
    const d1 = dateForInstallmentInSeries({
      knownISO: "2026-07-22",
      knownNumber: 1,
      targetNumber: 1,
      closingDay: 24,
      dueDay: 10,
    });
    const d2 = dateForInstallmentInSeries({
      knownISO: "2026-07-22",
      knownNumber: 1,
      targetNumber: 2,
      closingDay: 24,
      dueDay: 10,
    });
    const d3 = dateForInstallmentInSeries({
      knownISO: "2026-07-22",
      knownNumber: 1,
      targetNumber: 3,
      closingDay: 24,
      dueDay: 10,
    });

    const aug = startOfMonth(new Date(2026, 7, 1));
    const sep = startOfMonth(new Date(2026, 8, 1));
    const oct = startOfMonth(new Date(2026, 9, 1));

    const card = { closing_day: 24, due_day: 10, owner_member_id: "b" };
    expect(
      txBelongsToEntreNosMonth(
        {
          id: "1",
          amount: 10,
          description: "p1",
          transaction_date: d1,
          paid_by_member_id: "b",
          consumer_member_id: "a",
          card,
        },
        aug
      )
    ).toBe(true);
    expect(
      txBelongsToEntreNosMonth(
        {
          id: "2",
          amount: 10,
          description: "p2",
          transaction_date: d2,
          paid_by_member_id: "b",
          consumer_member_id: "a",
          card,
        },
        sep
      )
    ).toBe(true);
    expect(
      txBelongsToEntreNosMonth(
        {
          id: "3",
          amount: 10,
          description: "p3",
          transaction_date: d3,
          paid_by_member_id: "b",
          consumer_member_id: "a",
          card,
        },
        oct
      )
    ).toBe(true);

    // Sem buraco em setembro
    expect(
      monthKey(paymentMonthForPurchase(d2, 24, 10))
    ).toBe("2026-09");
  });
});

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
