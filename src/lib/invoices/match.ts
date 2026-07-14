/** Normaliza descrição p/ dedupe (remove parcela e ruído). */
export function normalizeInvoiceDescription(description: string): string {
  return description
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\(\s*\d{1,2}\s*\/\s*\d{1,2}\s*\)/g, " ")
    .replace(/\b\d{1,2}\s*\/\s*\d{1,2}\b/g, " ")
    .replace(/[^a-z0-9*\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function chargeMatchKey(
  date: string,
  description: string,
  amount: number
): string {
  return `${date}|${normalizeInvoiceDescription(description)}|${Number(amount).toFixed(2)}`;
}

/** Match de parcela independente da data do ciclo (atualiza scheduled → confirmed). */
export function installmentMatchKey(
  description: string,
  amount: number,
  installmentNumber: number,
  totalInstallments: number
): string {
  return `${normalizeInvoiceDescription(description)}|${Number(amount).toFixed(2)}|${installmentNumber}/${totalInstallments}`;
}

export type ExistingCardTx = {
  id: string;
  transaction_date: string;
  description: string;
  amount: number;
  status: string;
  is_installment?: boolean | null;
  installment_number?: number | null;
  total_installments?: number | null;
  installment_group_id?: string | null;
};

export function indexExistingCardTxs(txs: ExistingCardTx[]) {
  const byCharge = new Map<string, ExistingCardTx>();
  const byInstallment = new Map<string, ExistingCardTx>();

  for (const t of txs) {
    const amount = Number(t.amount);
    byCharge.set(
      chargeMatchKey(t.transaction_date, t.description, amount),
      t
    );
    if (
      t.is_installment &&
      t.installment_number &&
      t.total_installments &&
      t.total_installments > 1
    ) {
      byInstallment.set(
        installmentMatchKey(
          t.description,
          amount,
          t.installment_number,
          t.total_installments
        ),
        t
      );
    } else {
      // também indexa "DESC (3/12)" parseado da descrição
      const m = t.description.match(/\((\d{1,2})\s*\/\s*(\d{1,2})\)\s*$/);
      if (m) {
        byInstallment.set(
          installmentMatchKey(
            t.description,
            amount,
            parseInt(m[1], 10),
            parseInt(m[2], 10)
          ),
          t
        );
      }
    }
  }

  return { byCharge, byInstallment };
}
