import { formatCurrency, formatDate } from "@/lib/utils/format";

export type InvoicePdfLine = {
  date: string;
  description: string;
  amount: number;
  installment?: string | null;
};

const MELZA_MARK_SVG = `
<svg viewBox="0 0 64 64" width="36" height="36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <rect width="64" height="64" rx="14" fill="#111111"/>
  <g transform="skewX(-10) translate(4 0)">
    <path fill="#FFFFFF" d="M9.2 49.2 18.6 14.4h7.1L36 35.6 45.1 14.4h7.1L43.4 49.2h-7.3l5.6-20.4L33.4 49.2h-5.1L20 28.8l-4.1 20.4H9.2Z"/>
  </g>
</svg>
`.trim();

/**
 * Gera fatura Melza e abre o diálogo de impressão (Salvar como PDF).
 * Usa iframe oculto — sem window.open / pop-up.
 */
export function downloadInvoicePdf(opts: {
  cardName: string;
  cycleLabel: string;
  from: string;
  to: string;
  total: number;
  paid?: number;
  remaining?: number;
  lines: InvoicePdfLine[];
  ownerName?: string | null;
}) {
  const paid = opts.paid ?? 0;
  const remaining =
    opts.remaining != null ? opts.remaining : Math.max(0, opts.total - paid);
  const generatedAt = new Date().toLocaleString("pt-BR");

  const purchaseLines = opts.lines.filter((l) => l.amount >= 0);
  const paymentLines = opts.lines.filter((l) => l.amount < 0);

  const rows = (lines: InvoicePdfLine[], kind: "purchase" | "payment") =>
    lines
      .map((l) => {
        const abs = Math.abs(l.amount);
        const amountLabel =
          kind === "payment"
            ? `− ${formatCurrency(abs)}`
            : formatCurrency(abs);
        return `
      <tr class="${kind === "payment" ? "payment" : ""}">
        <td class="date">${escapeHtml(formatDate(l.date))}</td>
        <td class="desc">
          ${escapeHtml(l.description)}
          ${
            l.installment
              ? `<span class="pill">${escapeHtml(l.installment)}</span>`
              : ""
          }
        </td>
        <td class="num ${kind === "payment" ? "credit" : ""}">${escapeHtml(
          amountLabel
        )}</td>
      </tr>`;
      })
      .join("");

  const title = `Fatura ${opts.cardName} — ${opts.cycleLabel}`;
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700;800&display=swap" rel="stylesheet" />
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #111111;
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .sheet {
      max-width: 720px;
      margin: 0 auto;
      padding: 36px 40px 48px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 28px;
      padding-bottom: 20px;
      border-bottom: 1px solid #E5E5EA;
    }
    .brand-name {
      font-size: 22px;
      font-weight: 800;
      font-style: italic;
      letter-spacing: -0.04em;
      line-height: 1;
      color: #111111;
    }
    .brand-tag {
      margin-top: 4px;
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #8E8E93;
    }
    .eyebrow {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #8E8E93;
      margin: 0 0 8px;
    }
    h1 {
      margin: 0;
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.03em;
      line-height: 1.15;
    }
    .sub {
      margin: 8px 0 0;
      font-size: 13px;
      color: #636366;
      line-height: 1.45;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin: 28px 0 32px;
    }
    .summary-card {
      border: 1px solid #E5E5EA;
      border-radius: 14px;
      padding: 14px 16px;
      background: #F2F2F7;
    }
    .summary-card.accent {
      background: #111111;
      border-color: #111111;
      color: #fff;
    }
    .summary-card .label {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #8E8E93;
      margin: 0 0 6px;
    }
    .summary-card.accent .label { color: rgba(255,255,255,0.55); }
    .summary-card .value {
      margin: 0;
      font-family: "JetBrains Mono", ui-monospace, Menlo, monospace;
      font-size: 18px;
      font-weight: 800;
      letter-spacing: -0.02em;
      white-space: nowrap;
    }
    .section-title {
      margin: 0 0 10px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #8E8E93;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      margin-bottom: 22px;
    }
    th, td {
      padding: 11px 8px;
      border-bottom: 1px solid #E5E5EA;
      text-align: left;
      vertical-align: top;
    }
    th {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #8E8E93;
      border-bottom: 1px solid #C7C7CC;
    }
    td.date {
      width: 88px;
      white-space: nowrap;
      color: #636366;
      font-size: 12px;
    }
    td.desc { word-break: break-word; }
    td.num {
      text-align: right;
      font-family: "JetBrains Mono", ui-monospace, Menlo, monospace;
      font-weight: 700;
      white-space: nowrap;
      width: 120px;
    }
    td.num.credit { color: #22C55E; }
    tr.payment td { background: #FAFAFA; }
    .pill {
      display: inline-block;
      margin-left: 6px;
      padding: 1px 7px;
      border-radius: 999px;
      border: 1px solid #E5E5EA;
      font-size: 10px;
      font-weight: 600;
      color: #636366;
      vertical-align: middle;
    }
    .empty {
      padding: 18px 8px;
      color: #8E8E93;
      font-size: 13px;
    }
    .foot {
      margin-top: 28px;
      padding-top: 16px;
      border-top: 1px solid #E5E5EA;
      display: flex;
      justify-content: space-between;
      gap: 12px;
      font-size: 11px;
      color: #C7C7CC;
    }
    .hint {
      margin-top: 20px;
      padding: 12px 14px;
      border-radius: 12px;
      background: #F2F2F7;
      font-size: 12px;
      color: #636366;
    }
    @media print {
      .sheet { padding: 0; max-width: none; }
      .hint { display: none; }
      .summary-card { break-inside: avoid; }
      tr { break-inside: avoid; }
      @page { margin: 14mm; size: A4; }
    }
    @media screen and (max-width: 640px) {
      .sheet { padding: 20px 16px 32px; }
      .summary { grid-template-columns: 1fr; }
      h1 { font-size: 22px; }
      .summary-card .value { font-size: 16px; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <header class="brand">
      ${MELZA_MARK_SVG}
      <div>
        <div class="brand-name">Melza</div>
        <div class="brand-tag">Fatura do cartão</div>
      </div>
    </header>

    <p class="eyebrow">Resumo do ciclo</p>
    <h1>${escapeHtml(opts.cardName)}</h1>
    <p class="sub">
      ${escapeHtml(opts.cycleLabel)}
      · ${escapeHtml(formatDate(opts.from))} a ${escapeHtml(formatDate(opts.to))}
      ${opts.ownerName ? `<br />Titular: ${escapeHtml(opts.ownerName)}` : ""}
    </p>

    <div class="summary">
      <div class="summary-card">
        <p class="label">Total da fatura</p>
        <p class="value">${escapeHtml(formatCurrency(opts.total))}</p>
      </div>
      <div class="summary-card">
        <p class="label">Já pago</p>
        <p class="value">${escapeHtml(formatCurrency(paid))}</p>
      </div>
      <div class="summary-card accent">
        <p class="label">Restante</p>
        <p class="value">${escapeHtml(formatCurrency(remaining))}</p>
      </div>
    </div>

    <p class="section-title">Lançamentos</p>
    <table>
      <thead>
        <tr>
          <th>Data</th>
          <th>Descrição</th>
          <th class="num">Valor</th>
        </tr>
      </thead>
      <tbody>
        ${
          purchaseLines.length
            ? rows(purchaseLines, "purchase")
            : `<tr><td class="empty" colspan="3">Nenhuma compra neste ciclo.</td></tr>`
        }
      </tbody>
    </table>

    ${
      paymentLines.length
        ? `
    <p class="section-title">Pagamentos registrados</p>
    <table>
      <thead>
        <tr>
          <th>Data</th>
          <th>Descrição</th>
          <th class="num">Valor</th>
        </tr>
      </thead>
      <tbody>
        ${rows(paymentLines, "payment")}
      </tbody>
    </table>`
        : ""
    }

    <div class="foot">
      <span>Gerado pelo Melza</span>
      <span>${escapeHtml(generatedAt)}</span>
    </div>

    <p class="hint">
      No diálogo de impressão, escolha <strong>Salvar como PDF</strong> (ou “Microsoft Print to PDF”).
    </p>
  </div>
</body>
</html>`;

  printHtmlDocument(html, title);
}

/**
 * Impressão via iframe — sem window.open (evita “pop-up bloqueado”).
 * No Safari/iOS o iframe precisa ter tamanho real antes do print().
 */
function printHtmlDocument(html: string, title: string) {
  if (typeof document === "undefined") {
    throw new Error("Geração de PDF só funciona no navegador.");
  }

  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", title);
  iframe.setAttribute("aria-hidden", "true");
  // Safari bloqueia print() em iframe 0×0 — usa viewport off-screen
  iframe.style.cssText = [
    "position:fixed",
    "left:0",
    "top:0",
    "width:100vw",
    "height:100vh",
    "opacity:0",
    "border:0",
    "pointer-events:none",
    "z-index:-1",
  ].join(";");
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = win?.document;
  if (!win || !doc) {
    iframe.remove();
    throw new Error(
      "Não foi possível abrir a impressão. Tente de novo ou use outro navegador."
    );
  }

  doc.open();
  doc.write(html);
  doc.close();

  let printed = false;
  const cleanup = () => {
    window.setTimeout(() => {
      try {
        iframe.remove();
      } catch {
        /* ignore */
      }
    }, 2000);
  };

  const runPrint = () => {
    if (printed) return;
    printed = true;
    try {
      win.focus();
      win.print();
    } catch (err) {
      cleanup();
      throw err instanceof Error
        ? err
        : new Error("Falha ao abrir o diálogo de impressão.");
    }
    cleanup();
  };

  // Fonts + layout antes do print
  window.setTimeout(runPrint, 450);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
