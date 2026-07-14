import { parseBankCsv } from "@/lib/utils/csv";
import {
  parseInstallmentHints,
  type NubankInvoiceLine,
} from "@/lib/invoices/nubank-pdf";

function isPaymentDescription(description: string): boolean {
  return /pagamento\s+recebido|pagamento\s+de\s+fatura|pagto\s+recebido|payment\s+received|bill\s+payment/i.test(
    description
  );
}

function isRefundDescription(description: string): boolean {
  return /^estorno\b|\brefund\b/i.test(description.trim());
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
 * Parser OFX/QFX Nubank (fatura cartão ou conta).
 * Aceita OFX 1.x SGML e 2.x XML (com tags de fechamento).
 */
export function parseNubankOfx(text: string): NubankInvoiceLine[] {
  const raw = text.replace(/^\uFEFF/, "");
  if (!/<OFX[\s>]|<STMTTRN[\s>]/i.test(raw)) {
    throw new Error("Arquivo OFX inválido.");
  }

  const isCreditCardStatement =
    /CREDITCARDMSGSRSV1|CCSTMTRS|CCACCTFROM/i.test(raw);

  const blocks = raw.split(/<STMTTRN[\s>]/i).slice(1);
  const rows: Array<{ date: string; description: string; amount: number }> =
    [];

  for (const block of blocks) {
    const chunk = block.split(/<\/STMTTRN\s*>/i)[0] ?? block;
    const dateRaw = ofxField(chunk, "DTPOSTED");
    const amountRaw = ofxField(chunk, "TRNAMT");
    const memo =
      ofxField(chunk, "MEMO") ||
      ofxField(chunk, "NAME") ||
      ofxField(chunk, "PAYEE") ||
      "";
    if (!dateRaw || !amountRaw || !memo.trim()) continue;

    const amountNum = parseOfxAmount(amountRaw);
    if (amountNum == null || amountNum === 0) continue;

    const trnType = (ofxField(chunk, "TRNTYPE") || "").toUpperCase();
    const description = memo.trim();

    if (isPaymentDescription(description) || isRefundDescription(description)) {
      continue;
    }

    // Pagamento clássico OFX: CREDIT com valor positivo
    if (trnType === "CREDIT" && amountNum > 0) {
      continue;
    }

    // Fatura cartão: valor positivo sem DEBIT e sem parecer compra
    // (ex.: crédito avulso). Compras Nubank às vezes vêm positivas + DEBIT.
    if (
      isCreditCardStatement &&
      amountNum > 0 &&
      trnType !== "DEBIT" &&
      trnType !== "POS" &&
      trnType !== "OTHER" &&
      trnType !== ""
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

/** Lê <TAG>valor</TAG> (XML) ou <TAG>valor (SGML). */
export function ofxField(block: string, tag: string): string | null {
  const closed = new RegExp(
    `<${tag}\\b[^>]*>\\s*([\\s\\S]*?)\\s*</${tag}\\s*>`,
    "i"
  );
  const closedMatch = block.match(closed);
  if (closedMatch) {
    return closedMatch[1].replace(/\s+/g, " ").trim();
  }

  const open = new RegExp(`<${tag}\\b[^>]*>\\s*([^<\\n\\r]*)`, "i");
  const openMatch = block.match(open);
  if (openMatch) {
    return openMatch[1].replace(/\s+/g, " ").trim();
  }
  return null;
}

export function parseOfxAmount(raw: string): number | null {
  let s = raw.trim().replace(/\s/g, "").replace(/R\$/gi, "");
  if (!s) return null;
  // BR: -1.234,56
  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
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
