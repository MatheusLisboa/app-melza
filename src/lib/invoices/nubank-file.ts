import { parseBankCsv } from "@/lib/utils/csv";
import {
  parseInstallmentHints,
  type NubankInvoiceLine,
} from "@/lib/invoices/nubank-pdf";

function isPaymentDescription(description: string): boolean {
  return /pagamento\s+recebido|pagamento\s+de\s+fatura|pagto\s+recebido|payment\s+received/i.test(
    description
  );
}

function isRefundDescription(description: string): boolean {
  return /^estorno\b|refund/i.test(description.trim());
}

/** Converte linhas CSV/OFX parseadas em compras da fatura (com parcela). */
export function bankRowsToInvoiceLines(
  rows: Array<{ date: string; description: string; amount: number }>
): NubankInvoiceLine[] {
  const out: NubankInvoiceLine[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const inst = parseInstallmentHints(row.description);
    const description = inst.cleanDescription || row.description;

    if (isPaymentDescription(description) || isRefundDescription(description)) {
      continue;
    }

    const key = `${row.date}|${description}|${row.amount.toFixed(2)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      id: `f-${out.length}-${row.date}-${row.amount}`,
      date: row.date,
      description,
      amount: row.amount,
      installmentCurrent: inst.current,
      installmentTotal: inst.total,
      kind: "charge",
    });
  }

  return out;
}

export function parseNubankInvoiceCsv(text: string): NubankInvoiceLine[] {
  const rows = parseBankCsv(text)
    .filter((r) => r.type === "expense")
    .map((r) => ({
      date: r.date,
      description: r.description,
      amount: r.amount,
    }));
  return bankRowsToInvoiceLines(rows);
}

/**
 * Parser OFX/QFX Nubank (fatura ou conta).
 * Lê blocos <STMTTRN> com DTPOSTED, TRNAMT, MEMO/NAME.
 */
export function parseNubankOfx(text: string): NubankInvoiceLine[] {
  const raw = text.replace(/^\uFEFF/, "");
  if (!/<OFX[\s>]|<STMTTRN[\s>]/i.test(raw)) {
    throw new Error("Arquivo OFX inválido.");
  }

  const blocks = raw.split(/<STMTTRN>/i).slice(1);
  const rows: Array<{ date: string; description: string; amount: number }> =
    [];

  for (const block of blocks) {
    const chunk = block.split(/<\/STMTTRN>/i)[0] ?? block;
    const dateRaw = ofxField(chunk, "DTPOSTED");
    const amountRaw = ofxField(chunk, "TRNAMT");
    const memo =
      ofxField(chunk, "MEMO") ||
      ofxField(chunk, "NAME") ||
      ofxField(chunk, "PAYEE") ||
      "";
    if (!dateRaw || !amountRaw || !memo.trim()) continue;

    const amountNum = Number(amountRaw.replace(",", "."));
    if (!Number.isFinite(amountNum) || amountNum === 0) continue;

    const trnType = (ofxField(chunk, "TRNTYPE") || "").toUpperCase();
    const description = memo.trim();

    // Pagamento / crédito → ignora (não é compra)
    if (
      isPaymentDescription(description) ||
      isRefundDescription(description) ||
      trnType === "CREDIT"
    ) {
      continue;
    }

    rows.push({
      date: ofxDateToISO(dateRaw),
      description,
      amount: Math.abs(amountNum),
    });
  }

  if (rows.length === 0) {
    throw new Error("Nenhuma compra encontrada no OFX.");
  }

  return bankRowsToInvoiceLines(rows);
}

function ofxField(block: string, tag: string): string | null {
  const re = new RegExp(`<${tag}>([^\\n\\r<]+)`, "i");
  const m = block.match(re);
  return m ? m[1].trim() : null;
}

function ofxDateToISO(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  }
  return value.slice(0, 10);
}

/** Detecta e parseia CSV ou OFX automaticamente. */
export function parseNubankInvoiceFile(
  text: string,
  fileName?: string
): NubankInvoiceLine[] {
  const name = (fileName || "").toLowerCase();
  const looksOfx =
    name.endsWith(".ofx") ||
    name.endsWith(".qfx") ||
    /<OFX[\s>]|<STMTTRN[\s>]/i.test(text);

  if (looksOfx) {
    return parseNubankOfx(text);
  }
  return parseNubankInvoiceCsv(text);
}
