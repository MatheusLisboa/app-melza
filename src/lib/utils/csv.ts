/** Escape e gera CSV com separador `;` (padrão BR / Excel) */
export function toCsv(
  headers: string[],
  rows: (string | number | null | undefined)[][]
): string {
  const escape = (cell: string | number | null | undefined) => {
    const raw = cell == null ? "" : String(cell);
    if (/[;"\n]/.test(raw)) {
      return `"${raw.replace(/"/g, '""')}"`;
    }
    return raw;
  };

  const lines = [
    headers.map(escape).join(";"),
    ...rows.map((row) => row.map(escape).join(";")),
  ];
  // BOM para Excel reconhecer UTF-8
  return "\uFEFF" + lines.join("\n");
}

export function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export type NubankParsedRow = {
  date: string; // YYYY-MM-DD
  description: string;
  amount: number; // sempre positivo
  type: "expense" | "income";
  raw: string;
};

/**
 * Parser genérico para CSV Nubank / Inter / OFX-like tabular.
 * Aceita: Data;Valor;Identificador;Descrição
 *     ou: Data,Valor,Identificador,Descrição
 *     ou: date,title,amount / Data,Estabelecimento,Valor
 *     ou Inter: Data Lançamento, Descrição, Valor
 */
export function parseNubankCsv(text: string): NubankParsedRow[] {
  return parseBankCsv(text);
}

/** Alias público para import multi-banco */
export function parseBankCsv(text: string): NubankParsedRow[] {
  const normalized = text.replace(/^\uFEFF/, "").trim();
  if (!normalized) return [];

  const firstLine = normalized.split(/\r?\n/)[0] ?? "";
  const delimiter = firstLine.includes(";") ? ";" : ",";

  const lines = normalized.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0], delimiter).map((h) =>
    h.trim().toLowerCase()
  );

  const idxDate = findCol(headers, [
    "data lançamento",
    "data lancamento",
    "data",
    "date",
  ]);
  const idxAmount = findCol(headers, ["valor", "amount", "value"]);
  const idxDesc = findCol(headers, [
    "descrição",
    "descricao",
    "title",
    "estabelecimento",
    "description",
    "histórico",
    "historico",
  ]);

  if (idxDate < 0 || idxAmount < 0 || idxDesc < 0) {
    throw new Error(
      "CSV inválido. Esperado colunas Data, Valor e Descrição (Nubank ou Inter)."
    );
  }

  // Fatura de cartão Nubank: valores positivos = compras (despesa)
  // Headers típicos: date,title,amount,category  |  Data,Estabelecimento,Valor
  const isCardBill =
    headers.some((h) => h.includes("estabelecimento")) ||
    headers.some((h) => h.includes("categoria") || h === "category") ||
    (headers.includes("title") &&
      headers.includes("amount") &&
      (headers.includes("date") || headers.some((h) => h.includes("data"))));

  const rows: NubankParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i], delimiter);
    if (cols.length < 3) continue;

    const date = parseDateToISO(cols[idxDate]?.trim() ?? "");
    const amountRaw = parseAmount(cols[idxAmount]?.trim() ?? "");
    const description = (cols[idxDesc] ?? "").trim();
    if (!date || !description || amountRaw === 0) continue;

    let type: "expense" | "income";
    if (isCardBill) {
      type = amountRaw > 0 ? "expense" : "income";
    } else {
      type = amountRaw < 0 ? "expense" : "income";
    }

    rows.push({
      date,
      description,
      amount: Math.abs(amountRaw),
      type,
      raw: lines[i],
    });
  }

  return rows;
}

function findCol(headers: string[], names: string[]) {
  return headers.findIndex((h) => names.some((n) => h.includes(n)));
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

function parseDateToISO(value: string): string | null {
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  // DD/MM/YYYY
  const br = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) {
    const [, d, m, y] = br;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

function parseAmount(value: string): number {
  const cleaned = value
    .replace(/R\$\s?/gi, "")
    .replace(/\s/g, "")
    .trim();
  if (!cleaned) return 0;
  // BR: 1.234,56 or -89,90
  if (cleaned.includes(",")) {
    return Number(cleaned.replace(/\./g, "").replace(",", ".")) || 0;
  }
  return Number(cleaned) || 0;
}
