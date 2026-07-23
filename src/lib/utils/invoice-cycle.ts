import { addMonths, endOfMonth, toISODate } from "@/lib/utils/format";

export type InvoiceCycle = {
  /**
   * Chave estável do ciclo = mês do *fechamento* (YYYY-MM).
   * Usada em queries / pay invoice.
   */
  key: string;
  /**
   * Chave de exibição = mês do *vencimento* (YYYY-MM).
   * Alinhada ao seletor do Entre Nós.
   */
  paymentKey: string;
  label: string;
  from: string;
  to: string;
  closingDate: string;
  dueDate: string | null;
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

function monthKeyFromParts(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

/** Vencimento cai no mês seguinte ao fechamento? (fecha 24, vence 10 → sim) */
export function dueFallsNextMonth(
  closingDay: number,
  dueDay: number | null | undefined
): boolean {
  if (typeof dueDay !== "number" || dueDay < 1 || dueDay > 31) return false;
  return dueDay <= closingDay;
}

/**
 * Mês civil do vencimento da fatura que fecha em `closingDate`.
 * Sem due_day → mês do fechamento.
 */
export function paymentMonthForClosingDate(
  closingDate: Date,
  closingDay: number,
  dueDay?: number | null
): Date {
  if (dueFallsNextMonth(closingDay, dueDay)) {
    return new Date(closingDate.getFullYear(), closingDate.getMonth() + 1, 1);
  }
  return new Date(closingDate.getFullYear(), closingDate.getMonth(), 1);
}

export function dueDateForClosing(
  closingDate: Date,
  closingDay: number,
  dueDay: number | null
): Date | null {
  if (dueDay == null || dueDay < 1 || dueDay > 31) return null;
  if (dueFallsNextMonth(closingDay, dueDay)) {
    const next = addMonths(closingDate, 1);
    return clampDay(next.getFullYear(), next.getMonth(), dueDay);
  }
  return clampDay(
    closingDate.getFullYear(),
    closingDate.getMonth(),
    dueDay
  );
}

function cycleLabel(
  closingDate: Date,
  dueDate: Date | null,
  dueDay: number | null
): string {
  const closeLabel = closingDate.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "short",
  });
  if (dueDate) {
    const dueLabel = dueDate.toLocaleDateString("pt-BR", {
      day: "numeric",
      month: "short",
    });
    return `Vence ${dueLabel} · fecha ${closeLabel}`;
  }
  if (dueDay) {
    return `Fecha ${closeLabel} · vence dia ${dueDay}`;
  }
  return `Fecha ${closeLabel}`;
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
  const prev = addMonths(closingDate, -1);
  const prevClose = clampDay(
    prev.getFullYear(),
    prev.getMonth(),
    closingDay
  );

  // Inclusivo: do dia do fechamento anterior até o dia antes do fechamento atual
  const fromISO = toISODate(prevClose);
  const toISO = toISODate(addDays(closingDate, -1));
  const dueDate = dueDateForClosing(closingDate, closingDay, dueDay);
  const paymentMonth = paymentMonthForClosingDate(
    closingDate,
    closingDay,
    dueDay
  );

  const todayISO = toISODate(today);
  const isCurrent = todayISO >= fromISO && todayISO <= toISO;
  const key = monthKeyFromParts(closingYear, closingMonth);
  const paymentKey = monthKeyFromParts(
    paymentMonth.getFullYear(),
    paymentMonth.getMonth()
  );

  return {
    key,
    paymentKey,
    label: cycleLabel(closingDate, dueDate, dueDay),
    from: fromISO,
    to: toISO,
    closingDate: toISODate(closingDate),
    dueDate: dueDate ? toISODate(dueDate) : null,
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

  // Mais recente (fecha depois) primeiro
  cycles.sort((a, b) => (a.closingDate < b.closingDate ? 1 : -1));

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

/** Rótulo curto do ciclo pelo mês de vencimento (Entre Nós / chips). */
export function invoicePaymentMonthLabel(cycle: Pick<InvoiceCycle, "paymentKey" | "key">): string {
  const key = cycle.paymentKey || cycle.key;
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", {
    month: "short",
    year: "2-digit",
  });
}
