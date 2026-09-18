export type RecurringLike = {
  amount: number;
  kind?: "expense" | "income" | null;
  next_billing_date?: string | null;
  is_active?: boolean;
};

export type MonthProjection = {
  balance: number;
  billsLeft: number;
  incomeLeft: number;
  leftover: number;
};

/**
 * Quanto tende a sobrar até o fim do mês:
 * saldo atual − faturas/assinaturas ainda a pagar + receitas recorrentes à receber.
 */
export function projectMonth(input: {
  balance: number;
  invoiceRemaining: number;
  recurrings: RecurringLike[];
  untilISO: string;
  fromISO: string;
}): MonthProjection {
  const balance = Number.isFinite(input.balance) ? input.balance : 0;
  const invoiceRemaining = Math.max(0, input.invoiceRemaining || 0);

  let billsLeft = invoiceRemaining;
  let incomeLeft = 0;

  for (const item of input.recurrings) {
    if (item.is_active === false) continue;
    const date = item.next_billing_date;
    if (!date) continue;
    if (date < input.fromISO || date > input.untilISO) continue;
    const amount = Math.max(0, Number(item.amount) || 0);
    if (item.kind === "income") incomeLeft += amount;
    else billsLeft += amount;
  }

  const leftover = Math.round((balance - billsLeft + incomeLeft) * 100) / 100;
  return {
    balance,
    billsLeft: Math.round(billsLeft * 100) / 100,
    incomeLeft: Math.round(incomeLeft * 100) / 100,
    leftover,
  };
}

export function yearMonthOf(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
