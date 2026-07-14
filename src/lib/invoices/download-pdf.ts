import { formatCurrency, formatDate } from "@/lib/utils/format";

export type InvoicePdfLine = {
  date: string;
  description: string;
  amount: number;
  installment?: string | null;
};

/**
 * Gera visualização da fatura e abre o diálogo de impressão
 * (Salvar como PDF no navegador).
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
      font-family: "SF Pro Text", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: #111;
      margin: 0;
      padding: 32px;
      background: #fff;
    }
    h1 { font-size: 22px; margin: 0 0 4px; }
    .sub { color: #666; font-size: 13px; margin-bottom: 24px; }
    .total {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 28px; font-weight: 700; margin: 8px 0 24px;
    }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { padding: 10px 8px; border-bottom: 1px solid #eee; text-align: left; }
    th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #888; }
    .num { text-align: right; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; white-space: nowrap; }
    .muted { color: #888; font-size: 12px; }
    .foot { margin-top: 28px; font-size: 11px; color: #999; }
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
      setTimeout(function () { window.print(); }, 250);
    };
  </script>
</body>
</html>`;

  const win = window.open("", "_blank", "noopener,noreferrer,width=800,height=900");
  if (!win) {
    throw new Error(
      "Pop-up bloqueado. Permita pop-ups para baixar o PDF da fatura."
    );
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
