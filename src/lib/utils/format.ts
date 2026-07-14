/** Extrai só dígitos */
export function digitsOnly(input: string): string {
  return input.replace(/\D/g, "");
}

/** Formata centavos → "1.234,56" */
export function formatCents(cents: number): string {
  const safe = Math.max(0, Math.floor(cents));
  const asNumber = safe / 100;
  return asNumber.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Número (reais) → centavos inteiros */
export function toCents(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(Math.abs(value) * 100);
}

/** Digits digitados (máscara BRL) → reais */
export function centsDigitsToNumber(digits: string): number {
  const cleaned = digitsOnly(digits);
  if (!cleaned) return 0;
  return parseInt(cleaned, 10) / 100;
}

export function formatCurrency(value: number, currency = "BRL"): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(value);
}

/** Display pt-BR sem símbolo — "1.234,56" */
export function formatBRL(value: number): string {
  if (!Number.isFinite(value)) return "";
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatDate(date: string | Date): string {
  const d =
    typeof date === "string"
      ? new Date(date + (date.length === 10 ? "T12:00:00" : ""))
      : date;
  return new Intl.DateTimeFormat("pt-BR").format(d);
}

export function formatMonthYear(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(date);
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Converte string "1.234,56" / "1234.56" / dígitos para number.
 * Preferir centsDigitsToNumber na digitação com máscara.
 */
export function parseBRL(input: string): number {
  const cleaned = input.replace(/[^\d,.-]/g, "").trim();
  if (!cleaned) return 0;
  if (cleaned.includes(",")) {
    return Number(cleaned.replace(/\./g, "").replace(",", ".")) || 0;
  }
  // Só dígitos → trata como centavos (máscara)
  if (/^\d+$/.test(cleaned)) {
    return centsDigitsToNumber(cleaned);
  }
  return Number(cleaned) || 0;
}

/** Dia do mês 1–31 a partir de digitação */
export function parseDayOfMonth(input: string): number | null {
  const d = digitsOnly(input).slice(0, 2);
  if (!d) return null;
  const n = parseInt(d, 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.min(n, 31);
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}
