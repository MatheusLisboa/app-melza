import { describe, expect, it } from "vitest";
import { sparklinePath, spendDelta, topCategoryInsight } from "./insights";

describe("spendDelta", () => {
  it("calcula variação", () => {
    expect(spendDelta(120, 100)).toEqual({
      current: 120,
      previous: 100,
      delta: 20,
      pct: 20,
    });
  });
});

describe("topCategoryInsight", () => {
  it("escolhe a maior variação absoluta", () => {
    const out = topCategoryInsight(
      [
        { name: "Alimentação", total: 800 },
        { name: "Lazer", total: 120 },
      ],
      [
        { name: "Alimentação", total: 650 },
        { name: "Lazer", total: 200 },
      ]
    );
    expect(out?.name).toBe("Alimentação");
    expect(out?.delta).toBe(150);
  });
});

describe("sparklinePath", () => {
  it("gera path SVG", () => {
    const d = sparklinePath([10, 20, 15], 100, 20, 0);
    expect(d.startsWith("M")).toBe(true);
    expect(d.includes("L")).toBe(true);
  });
});
