import { toISODate } from "@/lib/utils/format";
import { dateForInstallmentInSeries } from "@/lib/finance/installment-dates";

export type NubankInvoiceLine = {
  id: string;
  date: string; // YYYY-MM-DD
  description: string;
  amount: number;
  /** Parcela atual na fatura (ex.: 3) */
  installmentCurrent: number | null;
  /** Total de parcelas (ex.: 12) */
  installmentTotal: number | null;
  /** charge = compra; payment = pagamento da fatura (ignorar no import padrão) */
  kind: "charge" | "payment" | "other";
};

const MONTHS: Record<string, number> = {
  jan: 0,
  fev: 1,
  mar: 2,
  abr: 3,
  mai: 4,
  jun: 5,
  jul: 6,
  ago: 7,
  set: 8,
  out: 9,
  nov: 10,
  dez: 11,
};

function parseBrAmount(raw: string): number | null {
  const cleaned = raw
    .replace(/R\$\s*/gi, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "")
    .trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.abs(n) : null;
}

function parseBrDate(day: string, mon: string, yearHint?: number): string | null {
  const m = MONTHS[mon.toLowerCase().slice(0, 3)];
  if (m == null) return null;
  const d = parseInt(day, 10);
  if (!Number.isFinite(d) || d < 1 || d > 31) return null;
  const y = yearHint ?? new Date().getFullYear();
  // Se mês futuro distante do atual no início do ano, assume ano anterior
  const now = new Date();
  let year = y;
  if (yearHint == null && m > now.getMonth() + 2) {
    year = now.getFullYear() - 1;
  }
  return toISODate(new Date(year, m, d));
}

/** Detecta “3/12”, “parcela 3 de 12”, etc. Prefere o padrão no fim do texto. */
export function parseInstallmentHints(text: string): {
  current: number | null;
  total: number | null;
  cleanDescription: string;
} {
  const cleanBase = text.replace(/\s+/g, " ").trim();

  function valid(current: number, total: number): boolean {
    return (
      current >= 1 &&
      total >= 2 &&
      total <= 48 &&
      current <= total
    );
  }

  function stripMatch(full: string, matched: string): string {
    return full.replace(matched, " ").replace(/\s+/g, " ").trim();
  }

  // 1) Forma explícita “parcela 3 de 10” / “parc. 3/10”
  const explicit =
    cleanBase.match(
      /parcela\s*(\d{1,2})\s*(?:de|\/)\s*(\d{1,2})/i
    ) ||
    cleanBase.match(/\bparc\.?\s*(\d{1,2})\s*\/\s*(\d{1,2})\b/i);
  if (explicit) {
    const current = parseInt(explicit[1], 10);
    const total = parseInt(explicit[2], 10);
    if (valid(current, total)) {
      return {
        current,
        total,
        cleanDescription: stripMatch(cleanBase, explicit[0]),
      };
    }
  }

  // 2) Sufixo no fim: “Loja 3/10” ou “Loja (3/10)” — o mais comum no Nubank
  const trailing = cleanBase.match(
    /(?:^|[\s\-–—(])(\d{1,2})\s*\/\s*(\d{1,2})\)?\s*$/
  );
  if (trailing) {
    const current = parseInt(trailing[1], 10);
    const total = parseInt(trailing[2], 10);
    if (valid(current, total)) {
      return {
        current,
        total,
        cleanDescription: stripMatch(cleanBase, trailing[0]).replace(
          /[\-–—(]\s*$/,
          ""
        ).trim(),
      };
    }
  }

  // 3) Qualquer X/Y válido — usa o ÚLTIMO (parcela costuma vir depois de datas)
  const all = Array.from(cleanBase.matchAll(/(\d{1,2})\s*\/\s*(\d{1,2})\b/g));
  for (let i = all.length - 1; i >= 0; i--) {
    const m = all[i];
    const current = parseInt(m[1], 10);
    const total = parseInt(m[2], 10);
    // Evita interpretar dia/mês comum (ex.: 15/03) como parcela
    if (current > 12 && total <= 12) continue;
    if (valid(current, total)) {
      return {
        current,
        total,
        cleanDescription: stripMatch(cleanBase, m[0]),
      };
    }
  }

  return { current: null, total: null, cleanDescription: cleanBase };
}

/**
 * Parser heurístico do texto da fatura Nubank.
 * Linhas típicas: "10 JUL IFOOD *IFOOD  3/12  R$ 42,90"
 */
export function parseNubankInvoiceText(text: string): NubankInvoiceLine[] {
  const yearMatch = text.match(/20\d{2}/);
  const yearHint = yearMatch ? parseInt(yearMatch[0], 10) : undefined;

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const out: NubankInvoiceLine[] = [];
  let i = 0;

  const lineRe =
    /^(\d{1,2})\s+([A-Za-zÀ-ú]{3})\s+(.+?)\s+R\$\s*([\d.]+,\d{2})$/i;
  const amountOnlyRe = /^R\$\s*([\d.]+,\d{2})$/i;
  const dateDescRe = /^(\d{1,2})\s+([A-Za-zÀ-ú]{3})\s+(.+)$/i;

  while (i < lines.length) {
    const line = lines[i];
    const lower = line.toLowerCase();

    // pular cabeçalhos / totais
    if (
      /total|valor\s+da\s+fatura|limite|vencimento|pagamento|resumo|nubank|cartão|cartao|fatura/i.test(
        lower
      ) &&
      !lineRe.test(line)
    ) {
      i++;
      continue;
    }

    let date: string | null = null;
    let description = "";
    let amount: number | null = null;

    const full = line.match(lineRe);
    if (full) {
      date = parseBrDate(full[1], full[2], yearHint);
      description = full[3].trim();
      amount = parseBrAmount(full[4]);
      i++;
    } else {
      // data+desc numa linha, valor na próxima
      const left = line.match(dateDescRe);
      const next = lines[i + 1] ?? "";
      const amt = next.match(amountOnlyRe);
      if (left && amt) {
        date = parseBrDate(left[1], left[2], yearHint);
        description = left[3].trim();
        amount = parseBrAmount(amt[1]);
        i += 2;
      } else {
        i++;
        continue;
      }
    }

    if (!date || !description || amount == null || amount <= 0) continue;

    const inst = parseInstallmentHints(description);
    const isPayment =
      /pagamento\s+recebido|pagamento\s+de\s+fatura|pagto\s+recebido/i.test(
        inst.cleanDescription
      );

    out.push({
      id: `h-${out.length}-${date}-${amount}`,
      date,
      description: inst.cleanDescription || description,
      amount,
      installmentCurrent: inst.current,
      installmentTotal: inst.total,
      kind: isPayment ? "payment" : "charge",
    });
  }

  // dedupe
  const seen = new Set<string>();
  return out.filter((row) => {
    const key = `${row.date}|${row.description}|${row.amount.toFixed(2)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Expande parcelas futuras a partir da linha da fatura atual. */
export function expandInstallmentRows(
  line: NubankInvoiceLine,
  opts?: { closingDay?: number | null; dueDay?: number | null }
): Array<{
  date: string;
  description: string;
  amount: number;
  installmentNumber: number;
  totalInstallments: number;
  status: "confirmed" | "scheduled";
}> {
  const total = line.installmentTotal;
  const current = line.installmentCurrent;
  if (!total || !current || total < 2) {
    return [
      {
        date: line.date,
        description: line.description,
        amount: line.amount,
        installmentNumber: 1,
        totalInstallments: 1,
        status: "confirmed",
      },
    ];
  }

  const rows = [];
  for (let n = current; n <= total; n++) {
    const date = dateForInstallmentInSeries({
      knownISO: line.date,
      knownNumber: current,
      targetNumber: n,
      closingDay: opts?.closingDay,
      dueDay: opts?.dueDay,
    });
    rows.push({
      date,
      description: `${line.description} (${n}/${total})`,
      amount: line.amount,
      installmentNumber: n,
      totalInstallments: total,
      status: (n === current ? "confirmed" : "scheduled") as
        | "confirmed"
        | "scheduled",
    });
  }
  return rows;
}
