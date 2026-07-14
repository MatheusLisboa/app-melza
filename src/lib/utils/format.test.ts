import { describe, expect, it } from "vitest";
import {
  centsDigitsToNumber,
  formatCents,
  parseBRL,
  parseDayOfMonth,
} from "@/lib/utils/format";

describe("money mask helpers", () => {
  it("formata centavos em pt-BR", () => {
    expect(formatCents(1)).toBe("0,01");
    expect(formatCents(150)).toBe("1,50");
    expect(formatCents(123456)).toBe("1.234,56");
  });

  it("converte dígitos digitados em reais", () => {
    expect(centsDigitsToNumber("1")).toBe(0.01);
    expect(centsDigitsToNumber("150")).toBe(1.5);
    expect(centsDigitsToNumber("123456")).toBe(1234.56);
    expect(centsDigitsToNumber("")).toBe(0);
  });

  it("parseBRL aceita formatado e dígitos", () => {
    expect(parseBRL("1.234,56")).toBe(1234.56);
    expect(parseBRL("123456")).toBe(1234.56);
  });

  it("parseDayOfMonth limita 1–31", () => {
    expect(parseDayOfMonth("")).toBeNull();
    expect(parseDayOfMonth("0")).toBeNull();
    expect(parseDayOfMonth("15")).toBe(15);
    expect(parseDayOfMonth("99")).toBe(31);
  });
});
