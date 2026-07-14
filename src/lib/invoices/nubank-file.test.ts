import { describe, expect, it } from "vitest";
import {
  parseNubankInvoiceCsv,
  parseNubankInvoiceFile,
  parseNubankOfx,
  parseOfxAmount,
} from "@/lib/invoices/nubank-file";
import { expandInstallmentRows } from "@/lib/invoices/nubank-pdf";
import {
  sumCardCommittedLimit,
  sumCardCycleSpend,
} from "@/lib/finance/card-cycle";
import { buildInvoiceCycle } from "@/lib/utils/invoice-cycle";

const CREDIT_CARD_OFX = `OFXHEADER:100
DATA:OFXSGML
VERSION:102

<OFX>
<CREDITCARDMSGSRSV1>
<CCSTMTRS>
<CURDEF>BRL
<CCACCTFROM>
<ACCTID>1234
</CCACCTFROM>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260505120000[-03:EST]
<TRNAMT>-127.42
<FITID>abc123
<MEMO>Magazine Luiza 3/12
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260515120000[-03:EST]
<TRNAMT>500.00
<FITID>pay1
<MEMO>Pagamento recebido
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260508120000[-03:EST]
<TRNAMT>-18.90
<FITID>uber1
<MEMO>Uber* viagem
</STMTTRN>
</BANKTRANLIST>
</CCSTMTRS>
</CREDITCARDMSGSRSV1>
</OFX>
`;

const XML_OFX = `<?xml version="1.0" encoding="UTF-8"?>
<OFX>
  <CREDITCARDMSGSRSV1>
    <CCSTMTRS>
      <BANKTRANLIST>
        <STMTTRN>
          <TRNTYPE>DEBIT</TRNTYPE>
          <DTPOSTED>20260701</DTPOSTED>
          <TRNAMT>
            -42.90
          </TRNAMT>
          <FITID>x1</FITID>
          <MEMO>IFOOD *IFOOD 2/10</MEMO>
        </STMTTRN>
        <STMTTRN>
          <TRNTYPE>CREDIT</TRNTYPE>
          <DTPOSTED>20260710</DTPOSTED>
          <TRNAMT>200.00</TRNAMT>
          <FITID>pay</FITID>
          <NAME>Pagamento recebido</NAME>
        </STMTTRN>
      </BANKTRANLIST>
    </CCSTMTRS>
  </CREDITCARDMSGSRSV1>
</OFX>
`;

/** OFX “estilo extrato” com valores positivos (alguns exports BR) */
const POSITIVE_PURCHASE_OFX = `<OFX>
<BANKMSGSRSV1>
<STMTRS>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>OTHER
<DTPOSTED>20260620
<TRNAMT>55.00
<FITID>1
<MEMO>Farmácia 1/3
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</BANKMSGSRSV1>
</OFX>
`;

describe("parse OFX fatura Nubank", () => {
  it("lê fatura cartão SGML: compras negativas, ignora pagamento", () => {
    const lines = parseNubankOfx(CREDIT_CARD_OFX);
    expect(lines).toHaveLength(2);
    expect(lines.map((l) => l.description).sort()).toEqual([
      "Magazine Luiza",
      "Uber* viagem",
    ]);
    const mag = lines.find((l) => l.description.includes("Magazine"))!;
    expect(mag.amount).toBe(127.42);
    expect(mag.installmentCurrent).toBe(3);
    expect(mag.installmentTotal).toBe(12);
    expect(mag.date).toBe("2026-05-05");
  });

  it("lê OFX XML com TRNAMT em linha separada", () => {
    const lines = parseNubankOfx(XML_OFX);
    expect(lines).toHaveLength(1);
    expect(lines[0].description).toBe("IFOOD *IFOOD");
    expect(lines[0].amount).toBe(42.9);
    expect(lines[0].installmentCurrent).toBe(2);
    expect(lines[0].installmentTotal).toBe(10);
  });

  it("aceita compra positiva em OFX de conta (não cartão)", () => {
    const lines = parseNubankOfx(POSITIVE_PURCHASE_OFX);
    expect(lines).toHaveLength(1);
    expect(lines[0].amount).toBe(55);
    expect(lines[0].installmentCurrent).toBe(1);
    expect(lines[0].installmentTotal).toBe(3);
  });

  it("parseOfxAmount aceita BR e US", () => {
    expect(parseOfxAmount("-89.90")).toBe(-89.9);
    expect(parseOfxAmount("-1.234,56")).toBe(-1234.56);
    expect(parseOfxAmount("42,90")).toBe(42.9);
  });

  it("detecta OFX pelo conteúdo do arquivo", () => {
    const lines = parseNubankInvoiceFile(CREDIT_CARD_OFX, "fatura.ofx");
    expect(lines.length).toBeGreaterThan(0);
  });
});

describe("parse CSV fatura Nubank", () => {
  it("lê date,title,amount,category e parcelas", () => {
    const csv = `date,title,amount,category
2026-05-03,Mercado,184.50,supermercado
2026-05-05,Magazine Luiza 3/12,127.42,casa
2026-05-15,Pagamento recebido,-500.00,
`;
    const lines = parseNubankInvoiceCsv(csv);
    expect(lines).toHaveLength(2);
    expect(lines.find((l) => l.installmentTotal === 12)?.amount).toBe(127.42);
  });
});

describe("cálculo da fatura / limite", () => {
  const cycle = buildInvoiceCycle(2026, 6, 15, 22, new Date("2026-07-10"));
  // from 2026-06-16 to 2026-07-15

  it("soma só compras do ciclo na fatura", () => {
    const txs = [
      {
        id: "1",
        amount: 100,
        transaction_type: "expense",
        status: "confirmed",
        card_id: "c",
        description: "A",
        transaction_date: "2026-07-01",
      },
      {
        id: "2",
        amount: 50,
        transaction_type: "expense",
        status: "scheduled",
        card_id: "c",
        description: "B futuro",
        transaction_date: "2026-08-01",
      },
      {
        id: "3",
        amount: 20,
        transaction_type: "income",
        status: "confirmed",
        card_id: "c",
        description: "estorno",
        transaction_date: "2026-07-02",
      },
    ];
    expect(sumCardCycleSpend(txs, cycle)).toBe(100);
  });

  it("disponível desconta ciclo + parcelas futuras (3/12)", () => {
    const simple = [
      {
        id: "1",
        amount: 100,
        transaction_type: "expense",
        status: "confirmed",
        card_id: "c",
        description: "Loja (3/12)",
        transaction_date: "2026-07-01",
        is_installment: true,
        installment_number: 3,
        total_installments: 12,
        installment_group_id: "g1",
      },
      {
        id: "2",
        amount: 100,
        transaction_type: "expense",
        status: "scheduled",
        card_id: "c",
        description: "Loja (4/12)",
        transaction_date: "2026-08-01",
        is_installment: true,
        installment_number: 4,
        total_installments: 12,
        installment_group_id: "g1",
      },
      {
        id: "3",
        amount: 100,
        transaction_type: "expense",
        status: "scheduled",
        card_id: "c",
        description: "Loja (5/12)",
        transaction_date: "2026-09-01",
        is_installment: true,
        installment_number: 5,
        total_installments: 12,
        installment_group_id: "g1",
      },
    ];

    const { cycleSpend, futureCommitted, committed } = sumCardCommittedLimit(
      simple,
      cycle
    );
    expect(cycleSpend).toBe(100);
    // scheduled = 200; estimado pelo 3/12 = 9×100 = 900 → usa 900
    expect(futureCommitted).toBe(900);
    expect(committed).toBe(1000);
  });
  it("estima parcelas futuras sem rows scheduled", () => {
    const txs = [
      {
        id: "1",
        amount: 50,
        transaction_type: "expense",
        status: "confirmed",
        card_id: "c",
        description: "Netflix (1/3)",
        transaction_date: "2026-07-01",
        is_installment: true,
        installment_number: 1,
        total_installments: 3,
        installment_group_id: "g2",
      },
    ];
    const { cycleSpend, futureCommitted, committed } = sumCardCommittedLimit(
      txs,
      cycle
    );
    expect(cycleSpend).toBe(50);
    expect(futureCommitted).toBe(100);
    expect(committed).toBe(150);
  });

  it("expandInstallmentRows gera só a partir da parcela atual", () => {
    const rows = expandInstallmentRows({
      id: "x",
      date: "2026-07-01",
      description: "Loja",
      amount: 100,
      installmentCurrent: 3,
      installmentTotal: 12,
      kind: "charge",
    });
    expect(rows).toHaveLength(10);
    expect(rows[0]).toMatchObject({
      installmentNumber: 3,
      status: "confirmed",
    });
    expect(rows[9]).toMatchObject({
      installmentNumber: 12,
      status: "scheduled",
    });
  });
});
