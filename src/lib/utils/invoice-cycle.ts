import { addMonths, endOfMonth, toISODate } from "@/lib/utils/format";

export type InvoiceCycle = {
  /** Chave YYYY-MM do mês de fechamento */
  key: string;
  label: string;
  from: string;
  to: string;
  closingDay: number;
  dueDay: number | null;
  isCurrent: boolean;
  isNext: boolean;
};

function clampDay(year: number, month: number, day: number): Date {
  const last = endOfMonth(new Date(year, month, 1)).getDate();
  return new Date(year, month, Math.min(day, last));
}

function cycleLabel(closing: Date, dueDay: number | null): string {
  const month = closing.toLocaleDateString("pt-BR", {
    month: "short",
    year: "numeric",
  });
  const due = dueDay ? ` · vence dia ${dueDay}` : "";
  return `Fecha ${closing.getDate()} ${month}${due}`;
}

/**
 * Ciclo da fatura pelo dia de fechamento.
 * Ex.: fecha dia 15 → do dia após o fechamento anterior até o dia 15.
 */
export function buildInvoiceCycle(
  closingYear: number,
  closingMonth: number,
  closingDay: number,
  dueDay: number | null,
  today = new Date()
): InvoiceCycle {
  const to = clampDay(closingYear, closingMonth, closingDay);
  const prevClose = clampDay(
    addMonths(to, -1).getFullYear(),
    addMonths(to, -1).getMonth(),
    closingDay
  );
  const fromDate = new Date(prevClose);
  fromDate.setDate(fromDate.getDate() + 1);

  const fromISO = toISODate(fromDate);
  const toISO = toISODate(to);
  const todayISO = toISODate(today);
  const isCurrent = todayISO >= fromISO && todayISO <= toISO;
  const key = `${closingYear}-${String(closingMonth + 1).padStart(2, "0")}`;

  return {
    key,
    label: cycleLabel(to, dueDay),
    from: fromISO,
    to: toISO,
    closingDay,
    dueDay,
    isCurrent,
    isNext: false,
  };
}

export function listInvoiceCycles(
  closingDay: number | null | undefined,
  dueDay: number | null | undefined,
  count = 12,
  today = new Date()
): InvoiceCycle[] {
  const day =
    closingDay && closingDay >= 1 && closingDay <= 31 ? closingDay : 1;
  const due = dueDay && dueDay >= 1 && dueDay <= 31 ? dueDay : null;
  const cursor = new Date(today.getFullYear(), today.getMonth(), 1);
  const cycles: InvoiceCycle[] = [];

  for (let i = -1; i < count; i++) {
    const d = addMonths(cursor, -i);
    cycles.push(
      buildInvoiceCycle(d.getFullYear(), d.getMonth(), day, due, today)
    );
  }

  cycles.sort((a, b) => (a.to < b.to ? 1 : -1));

  const todayISO = toISODate(today);
  let markedNext = false;
  for (const c of cycles) {
    c.isNext = false;
  }
  for (const c of [...cycles].reverse()) {
    if (!markedNext && c.from > todayISO) {
      c.isNext = true;
      markedNext = true;
    }
  }

  const seen = new Set<string>();
  return cycles.filter((c) => {
    if (seen.has(c.key)) return false;
    seen.add(c.key);
    return true;
  });
}

export function defaultCycleKey(cycles: InvoiceCycle[]): string {
  const current = cycles.find((c) => c.isCurrent);
  if (current) return current.key;
  const next = cycles.find((c) => c.isNext);
  if (next) return next.key;
  return cycles[0]?.key ?? "";
}
