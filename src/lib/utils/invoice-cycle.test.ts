import { describe, expect, it } from "vitest";
import {
  buildInvoiceCycle,
  defaultCycleKey,
  dueFallsNextMonth,
  invoicePaymentMonthLabel,
  listInvoiceCycles,
  paymentMonthForClosingDate,
} from "@/lib/utils/invoice-cycle";
import {
  entreNosCardCycle,
  paymentMonthForPurchase,
} from "@/lib/finance/entre-nos";
import { startOfMonth } from "@/lib/utils/format";
import { parseInstallmentHints } from "@/lib/invoices/nubank-pdf";

describe("invoice cycle", () => {
  it("fecha às 00:01 do dia D: ciclo = D anterior … D−1", () => {
    // Fecha dia 15/jul → de 15/jun a 14/jul
    const c = buildInvoiceCycle(2026, 6, 15, 22, new Date("2026-07-10"));
    expect(c.from).toBe("2026-06-15");
    expect(c.to).toBe("2026-07-14");
    expect(c.closingDate).toBe("2026-07-15");
    expect(c.dueDate).toBe("2026-07-22");
    expect(c.paymentKey).toBe("2026-07");
    expect(c.isCurrent).toBe(true);
    expect(c.isFuture).toBe(false);
  });

  it("fecha 24 vence 10: paymentKey é o mês seguinte ao fechamento", () => {
    const c = buildInvoiceCycle(2026, 6, 24, 10, new Date("2026-07-10"));
    expect(c.key).toBe("2026-07"); // fechamento julho
    expect(c.paymentKey).toBe("2026-08"); // vence agosto
    expect(c.dueDate).toBe("2026-08-10");
    expect(c.closingDate).toBe("2026-07-24");
    expect(c.from).toBe("2026-06-24");
    expect(c.to).toBe("2026-07-23");
    expect(invoicePaymentMonthLabel(c).toLowerCase()).toContain("ago");
  });

  it("compra no dia do fechamento entra na fatura seguinte", () => {
    const june = buildInvoiceCycle(2026, 5, 5, 12, new Date(2026, 5, 3));
    expect(june.from).toBe("2026-05-05");
    expect(june.to).toBe("2026-06-04");

    const july = buildInvoiceCycle(2026, 6, 5, 12, new Date(2026, 5, 5));
    expect(july.from).toBe("2026-06-05");
    expect(july.to).toBe("2026-07-04");
    expect(july.isCurrent).toBe(true);
  });

  it("lista ciclos passados e futuros", () => {
    const cycles = listInvoiceCycles(
      15,
      22,
      { past: 3, future: 6 },
      new Date("2026-07-10")
    );
    const futures = cycles.filter((c) => c.isFuture);
    expect(futures.length).toBeGreaterThanOrEqual(5);
    const key = defaultCycleKey(cycles);
    const chosen = cycles.find((c) => c.key === key);
    expect(chosen?.isCurrent || chosen?.isNext).toBeTruthy();
  });

  it("legado count ainda lista 1 ciclo à frente", () => {
    const cycles = listInvoiceCycles(15, 22, 6, new Date("2026-07-10"));
    expect(cycles.some((c) => c.isNext)).toBe(true);
  });
});

describe("Faturas ↔ Entre Nós alinhados", () => {
  it("mesmo from/to para o mês de vencimento agosto (fecha 24, vence 10)", () => {
    const invoice = buildInvoiceCycle(2026, 6, 24, 10); // fecha jul
    expect(invoice.paymentKey).toBe("2026-08");

    const august = startOfMonth(new Date(2026, 7, 1));
    const entre = entreNosCardCycle(august, 24, 10);
    expect(entre?.from).toBe(invoice.from);
    expect(entre?.to).toBe(invoice.to);

    // Compra no ciclo cai no mesmo mês Entre Nós
    expect(
      paymentMonthForPurchase("2026-07-22", 24, 10).getMonth()
    ).toBe(7); // agosto
  });

  it("dueFallsNextMonth e paymentMonthForClosingDate coerentes", () => {
    expect(dueFallsNextMonth(24, 10)).toBe(true);
    expect(dueFallsNextMonth(5, 12)).toBe(false);
    const close = new Date(2026, 6, 24);
    const pay = paymentMonthForClosingDate(close, 24, 10);
    expect(pay.getFullYear()).toBe(2026);
    expect(pay.getMonth()).toBe(7);
  });
});

describe("parseInstallmentHints", () => {
  it("prioriza parcela no fim do texto (não datas no meio)", () => {
    expect(parseInstallmentHints("UBER TRIP 15/03 3/10")).toMatchObject({
      current: 3,
      total: 10,
    });
    expect(parseInstallmentHints("Magazine Luiza 3/10")).toMatchObject({
      current: 3,
      total: 10,
    });
    expect(parseInstallmentHints("IFOOD *IFOOD (3/10)")).toMatchObject({
      current: 3,
      total: 10,
    });
    expect(parseInstallmentHints("parcela 3 de 10 Amazon")).toMatchObject({
      current: 3,
      total: 10,
    });
  });

  it("não confunde 3/10 com 4/10", () => {
    const a = parseInstallmentHints("Loja XYZ 3/10");
    expect(a.current).toBe(3);
    expect(a.total).toBe(10);
    expect(a.cleanDescription).not.toMatch(/\d\s*\/\s*\d/);
  });
});
