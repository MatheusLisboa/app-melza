import type { Transaction } from "@/types";

type Installmentish = Pick<
  Transaction,
  | "id"
  | "description"
  | "amount"
  | "is_installment"
  | "installment_number"
  | "total_installments"
  | "installment_group_id"
  | "transaction_date"
>;

/** Remove sufixo "(3/12)" do título da parcela. */
export function stripInstallmentSuffix(description: string): string {
  return description
    .replace(/\s*\(\d+\s*\/\s*\d+\)\s*$/, "")
    .replace(/\s+\d+\s*\/\s*\d+\s*$/, "")
    .trim();
}

/**
 * Em Histórico / Últimas transações: mostra a compra (1ª parcela),
 * não cada parcela futura do grupo.
 */
export function collapseInstallmentPurchases<T extends Installmentish>(
  txs: T[]
): Array<
  T & {
    displayDescription: string;
    displayAmount: number;
    purchaseInstallments: number | null;
  }
> {
  const result: Array<
    T & {
      displayDescription: string;
      displayAmount: number;
      purchaseInstallments: number | null;
    }
  > = [];

  for (const tx of txs) {
    if (!tx.is_installment || !tx.installment_group_id) {
      result.push({
        ...tx,
        displayDescription: tx.description,
        displayAmount: Number(tx.amount),
        purchaseInstallments: null,
      });
      continue;
    }

    // Só a 1ª parcela representa o lançamento da compra
    if (tx.installment_number != null && tx.installment_number !== 1) {
      continue;
    }

    const total = tx.total_installments ?? 1;
    const unit = Number(tx.amount);
    result.push({
      ...tx,
      displayDescription: stripInstallmentSuffix(tx.description),
      displayAmount: unit * total,
      purchaseInstallments: total > 1 ? total : null,
    });
  }

  return result;
}
