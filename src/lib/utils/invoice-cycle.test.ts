import { describe, expect, it } from "vitest";
import {
  buildInvoiceCycle,
  defaultCycleKey,
  listInvoiceCycles,
} from "@/lib/utils/invoice-cycle";
import { parseInstallmentHints } from "@/lib/invoices/nubank-pdf";

describe("invoice cycle", () => {
  it("fecha às 00:01 do dia D: ciclo = D anterior … D−1", () => {
    // Fecha dia 15/jul → de 15/jun a 14/jul
    const c = buildInvoiceCycle(2026, 6, 15, 22, new Date("2026-07-10"));
    expect(c.from).toBe("2026-06-15");
    expect(c.to).toBe("2026-07-14");
    expect(c.isCurrent).toBe(true);
    expect(c.isFuture).toBe(false);
  });

  it("compra no dia do fechamento entra na fatura seguinte", () => {
    // Fecha dia 5: fatura que “fecha” em 05/jun cobre 05/mai … 04/jun
    const june = buildInvoiceCycle(2026, 5, 5, 12, new Date(2026, 5, 3));
    expect(june.from).toBe("2026-05-05");
    expect(june.to).toBe("2026-06-04");

    const july = buildInvoiceCycle(2026, 6, 5, 12, new Date(2026, 5, 5));
    expect(july.from).toBe("2026-06-05");
    expect(july.to).toBe("2026-07-04");
    // 05/jun já está no ciclo de julho (após 00:01 do fechamento)
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
