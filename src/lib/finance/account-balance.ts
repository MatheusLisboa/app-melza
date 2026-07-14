import type { SupabaseClient } from "@supabase/supabase-js";

type TxType =
  | "expense"
  | "income"
  | "transfer"
  | "loan_given"
  | "loan_received"
  | "loan_repayment";

/** Delta no saldo da conta: receita +, despesa −. Transferências tratadas à parte. */
export function accountBalanceDelta(
  transactionType: TxType | string,
  amount: number
): number {
  const n = Number(amount) || 0;
  if (
    transactionType === "income" ||
    transactionType === "loan_received"
  ) {
    return n;
  }
  if (
    transactionType === "expense" ||
    transactionType === "loan_given" ||
    transactionType === "loan_repayment"
  ) {
    return -n;
  }
  return 0;
}

export async function adjustAccountBalance(
  supabase: SupabaseClient,
  accountId: string,
  delta: number
) {
  if (!accountId || !delta) return;
  const { data, error } = await supabase
    .from("accounts")
    .select("current_balance")
    .eq("id", accountId)
    .single();
  if (error || !data) return;
  const next = Number(data.current_balance ?? 0) + delta;
  await supabase
    .from("accounts")
    .update({ current_balance: next })
    .eq("id", accountId);
}
