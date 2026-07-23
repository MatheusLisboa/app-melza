/**
 * Datas de parcelas alinhadas ao ciclo do cartão (Entre Nós / Faturas).
 */

import {
  entreNosCardCycle,
  paymentMonthForPurchase,
} from "@/lib/finance/entre-nos";
import { addMonths, toISODate } from "@/lib/utils/format";

/**
 * Data da parcela `targetNumber` a partir de uma parcela conhecida.
 * Com closing_day: avança mês de *pagamento* (sem pular/comprimir ciclos).
 * Sem closing_day: +N meses civis (com addMonths seguro).
 */
export function dateForInstallmentInSeries(opts: {
  knownISO: string;
  knownNumber: number;
  targetNumber: number;
  closingDay?: number | null;
  dueDay?: number | null;
}): string {
  const known = Math.max(1, opts.knownNumber);
  const target = Math.max(1, opts.targetNumber);
  const delta = target - known;

  if (delta === 0) return opts.knownISO;

  const closing =
    typeof opts.closingDay === "number" &&
    opts.closingDay >= 1 &&
    opts.closingDay <= 31
      ? opts.closingDay
      : null;

  if (closing == null) {
    const base = new Date(opts.knownISO + "T12:00:00");
    return toISODate(addMonths(base, delta));
  }

  const knownPay = paymentMonthForPurchase(
    opts.knownISO,
    closing,
    opts.dueDay
  );
  const targetPay = addMonths(knownPay, delta);
  const cycle = entreNosCardCycle(targetPay, closing, opts.dueDay);
  // Último dia do ciclo de compras → cai na fatura / mês de pagamento certos
  return cycle?.to ?? toISODate(addMonths(new Date(opts.knownISO + "T12:00:00"), delta));
}

export function datesForInstallmentSeries(opts: {
  knownISO: string;
  knownNumber: number;
  fromNumber: number;
  toNumber: number;
  closingDay?: number | null;
  dueDay?: number | null;
}): Array<{ number: number; date: string }> {
  const out: Array<{ number: number; date: string }> = [];
  for (let n = opts.fromNumber; n <= opts.toNumber; n++) {
    out.push({
      number: n,
      date: dateForInstallmentInSeries({
        knownISO: opts.knownISO,
        knownNumber: opts.knownNumber,
        targetNumber: n,
        closingDay: opts.closingDay,
        dueDay: opts.dueDay,
      }),
    });
  }
  return out;
}
