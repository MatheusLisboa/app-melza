import { formatCurrency, formatDate } from "@/lib/utils/format";

export type InvoicePdfLine = {
  date: string;
  description: string;
  amount: number;
  installment?: string | null;
};

/**
 * Gera visualização da fatura e abre impressão (Salvar como PDF).
 * Usa Blob URL — evita falha de window.open com noopener (retorna null).
 */
export function downloadInvoicePdf(opts: {
  cardName: string;
  cycleLabel: string;
  from: string;
  to: string;
  total: number;
  lines: InvoicePdfLine[];
  ownerName?: string | null;
}) {
  const rows = opts.lines
    .map(
      (l) => `
      <tr>
        <td>${escapeHtml(formatDate(l.date))}</td>
        <td>${escapeHtml(l.description)}${
          l.installment
            ? ` <span class="muted">(${escapeHtml(l.installment)})</span>`
            : ""
        }</td>
        <td class="num">${escapeHtml(formatCurrency(l.amount))}</td>
      </tr>`
    )
    .join("");

  const title = `Fatura ${opts.cardName} — ${opts.cycleLabel}`;
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body {
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: #111;
      margin: 0;
      padding: 32px;
      background: #fff;
    }
    h1 { font-size: 22px; margin: 0 0 4px; font-weight: 700; }
    .sub { color: #8E8E93; font-size: 13px; margin-bottom: 24px; }
    .total {
      font-family: "JetBrains Mono", ui-monospace, Menlo, monospace;
      font-size: 28px; font-weight: 800; margin: 8px 0 24px;
    }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { padding: 10px 8px; border-bottom: 1px solid #E5E5EA; text-align: left; }
    th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #8E8E93; }
    .num { text-align: right; font-family: "JetBrains Mono", ui-monospace, Menlo, monospace; white-space: nowrap; }
    .muted { color: #8E8E93; font-size: 12px; }
    .foot { margin-top: 28px; font-size: 11px; color: #C7C7CC; }
    @media print {
      body { padding: 12px; }
      @page { margin: 16mm; }
    }
  </style>
</head>
<body>
  <p class="muted" style="margin:0 0 16px">Melza</p>
  <h1>${escapeHtml(opts.cardName)}</h1>
  <p class="sub">
    ${escapeHtml(opts.cycleLabel)} · ${escapeHtml(formatDate(opts.from))} a ${escapeHtml(formatDate(opts.to))}
    ${opts.ownerName ? ` · ${escapeHtml(opts.ownerName)}` : ""}
  </p>
  <p class="total">${escapeHtml(formatCurrency(opts.total))}</p>
  <table>
    <thead>
      <tr>
        <th>Data</th>
        <th>Descrição</th>
        <th class="num">Valor</th>
      </tr>
    </thead>
    <tbody>
      ${rows || `<tr><td colspan="3">Nenhuma compra neste ciclo.</td></tr>`}
    </tbody>
  </table>
  <p class="foot">Gerado pelo Melza · ${escapeHtml(new Date().toLocaleString("pt-BR"))}</p>
  <script>
    window.onload = function () {
      setTimeout(function () { window.print(); }, 300);
    };
  </script>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (!win) {
    URL.revokeObjectURL(url);
    throw new Error(
      "Pop-up bloqueado. Permita pop-ups neste site para gerar o PDF."
    );
  }
  // Revoga depois que a aba carregou
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
