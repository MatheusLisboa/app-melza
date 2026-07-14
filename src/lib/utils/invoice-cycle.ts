import { addMonths, endOfMonth, toISODate } from "@/lib/utils/format";

export type InvoiceCycle = {
  /** Chave YYYY-MM do mês de fechamento */
  key: string;
  label: string;
  from: string;
  to: string;
  /** Dia civil do fechamento (00:01 deste dia encerra o ciclo anterior) */
  closingDay: number;
  dueDay: number | null;
  isCurrent: boolean;
  isNext: boolean;
  /** Ciclo ainda não começou (compras futuras / parcelas agendadas) */
  isFuture: boolean;
};

function clampDay(year: number, month: number, day: number): Date {
  const last = endOfMonth(new Date(year, month, 1)).getDate();
  return new Date(year, month, Math.min(day, last));
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
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
 *
 * O cartão fecha às 00:01 do dia de fechamento:
 * - compras nesse dia (a partir de 00:01) entram na fatura *seguinte*
 * - o ciclo que fecha no dia D inclui do fechamento anterior (D do mês passado)
 *   até o dia anterior a D (D−1)
 *
 * Ex.: fecha dia 5 → fatura de junho: 05/mai … 04/jun
 *      compra em 05/jun → fatura de julho
 */
export function buildInvoiceCycle(
  closingYear: number,
  closingMonth: number,
  closingDay: number,
  dueDay: number | null,
  today = new Date()
): InvoiceCycle {
  const closingDate = clampDay(closingYear, closingMonth, closingDay);
  const prevClose = clampDay(
    addMonths(closingDate, -1).getFullYear(),
    addMonths(closingDate, -1).getMonth(),
    closingDay
  );

  // Inclusivo: do dia do fechamento anterior até o dia antes do fechamento atual
  const fromISO = toISODate(prevClose);
  const toISO = toISODate(addDays(closingDate, -1));

  const todayISO = toISODate(today);
  const isCurrent = todayISO >= fromISO && todayISO <= toISO;
  const key = `${closingYear}-${String(closingMonth + 1).padStart(2, "0")}`;

  return {
    key,
    label: cycleLabel(closingDate, dueDay),
    from: fromISO,
    to: toISO,
    closingDay,
    dueDay,
    isCurrent,
    isNext: false,
    isFuture: fromISO > todayISO,
  };
}

export type ListInvoiceCyclesOpts = {
  /** Meses passados a listar (default 12) */
  past?: number;
  /** Meses futuros a listar (default 12 — parcelas longas) */
  future?: number;
};

/**
 * Lista ciclos de fatura.
 * Aceita `count` legado (passados + 1 próximo) ou `{ past, future }`.
 */
export function listInvoiceCycles(
  closingDay: number | null | undefined,
  dueDay: number | null | undefined,
  countOrOpts: number | ListInvoiceCyclesOpts = 12,
  today = new Date()
): InvoiceCycle[] {
  const day =
    closingDay && closingDay >= 1 && closingDay <= 31 ? closingDay : 1;
  const due = dueDay && dueDay >= 1 && dueDay <= 31 ? dueDay : null;
  const cursor = new Date(today.getFullYear(), today.getMonth(), 1);

  const past =
    typeof countOrOpts === "number" ? countOrOpts : (countOrOpts.past ?? 12);
  const future =
    typeof countOrOpts === "number" ? 1 : (countOrOpts.future ?? 12);

  const cycles: InvoiceCycle[] = [];

  for (let i = -future; i < past; i++) {
    const d = addMonths(cursor, -i);
    cycles.push(
      buildInvoiceCycle(d.getFullYear(), d.getMonth(), day, due, today)
    );
  }

  cycles.sort((a, b) => (a.to < b.to ? 1 : -1));

  const todayISO = toISODate(today);
  for (const c of cycles) {
    c.isNext = false;
    c.isFuture = c.from > todayISO;
  }

  let markedNext = false;
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
