import { describe, expect, it } from "vitest";
import {
  buildInvoiceCycle,
  defaultCycleKey,
  listInvoiceCycles,
} from "@/lib/utils/invoice-cycle";

describe("invoice cycle", () => {
  it("fecha dia 15: ciclo vai do 16 anterior ao 15", () => {
    const c = buildInvoiceCycle(2026, 6, 15, 22, new Date("2026-07-10"));
    // closing July 15 → from June 16 to July 15
    expect(c.from).toBe("2026-06-16");
    expect(c.to).toBe("2026-07-15");
    expect(c.isCurrent).toBe(true);
  });

  it("lista ciclos e escolhe atual por padrão", () => {
    const cycles = listInvoiceCycles(15, 22, 6, new Date("2026-07-10"));
    expect(cycles.length).toBeGreaterThan(3);
    const key = defaultCycleKey(cycles);
    const chosen = cycles.find((c) => c.key === key);
    expect(chosen?.isCurrent || chosen?.isNext).toBeTruthy();
  });
});
