"use server";

import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/supabase/workspace";
import {
  transactionSchema,
  type TransactionInput,
} from "@/lib/validations/transaction";
import { addMonths, toISODate } from "@/lib/utils/format";
import { parsePaymentMethod } from "@/lib/utils/payment-method";
import { tagsForPaymentChannel } from "@/lib/utils/payment-channel";
import {
  accountBalanceDelta,
  adjustAccountBalance,
} from "@/lib/finance/account-balance";
import { randomUUID } from "crypto";

export async function createTransactionAction(raw: TransactionInput) {
  const parsed = transactionSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const input = parsed.data;
  const member = await requireMember();
  const supabase = await createClient();
  const payment = parsePaymentMethod(input.payment_method);

  if (!payment) {
    return { error: "Meio de pagamento inválido" };
  }

  const card_id = payment.kind === "card" ? payment.id : null;
  const account_id = payment.kind === "account" ? payment.id : null;
  const tags = tagsForPaymentChannel(input.payment_channel);

  let third_party_id: string | null = null;
  let loan_id: string | null = null;

  if (
    input.third_party_name?.trim() &&
    (input.transaction_type === "loan_given" ||
      input.transaction_type === "loan_received" ||
      input.transaction_type === "loan_repayment")
  ) {
    const { data: existing } = await supabase
      .from("third_parties")
      .select("id")
      .eq("workspace_id", member.workspace_id)
      .ilike("name", input.third_party_name.trim())
      .maybeSingle();

    if (existing) {
      third_party_id = existing.id;
    } else {
      const { data: created, error } = await supabase
        .from("third_parties")
        .insert({
          workspace_id: member.workspace_id,
          name: input.third_party_name.trim(),
          relationship: input.third_party_relationship || null,
        })
        .select("id")
        .single();
      if (error) return { error: error.message };
      third_party_id = created.id;
    }
  }

  if (
    input.transaction_type === "loan_given" ||
    input.transaction_type === "loan_received"
  ) {
    const { data: loan, error: loanError } = await supabase
      .from("loans")
      .insert({
        workspace_id: member.workspace_id,
        third_party_id,
        direction: input.transaction_type === "loan_given" ? "given" : "received",
        original_amount: input.amount,
        paid_amount: 0,
        description: input.description,
        status: "open",
      })
      .select("id")
      .single();
    if (loanError) return { error: loanError.message };
    loan_id = loan.id;
  }

  // Transferência: 2 txs
  if (input.transaction_type === "transfer") {
    if (payment.kind !== "account" || !input.transfer_to_account_id) {
      return { error: "Transferência exige conta de origem e destino" };
    }
    if (payment.id === input.transfer_to_account_id) {
      return { error: "Contas de origem e destino devem ser diferentes" };
    }

    const transferGroupId = randomUUID();
    const base = {
      workspace_id: member.workspace_id,
      created_by_member_id: member.id,
      paid_by_member_id: input.paid_by_member_id || member.id,
      consumer_member_id:
        input.consumer_member_id ||
        input.paid_by_member_id ||
        member.id,
      amount: input.amount,
      currency: "BRL",
      transaction_type: "transfer" as const,
      description: input.description,
      notes: input.notes || null,
      category_id: input.category_id || null,
      status: "confirmed" as const,
      transfer_group_id: transferGroupId,
      transaction_date: input.transaction_date,
    };

    const { error: outError } = await supabase.from("transactions").insert({
      ...base,
      account_id: payment.id,
      transfer_to_account_id: input.transfer_to_account_id,
    });
    if (outError) return { error: outError.message };

    const { error: inError } = await supabase.from("transactions").insert({
      ...base,
      account_id: input.transfer_to_account_id,
      transfer_to_account_id: null,
      description: `${input.description} (entrada)`,
    });
    if (inError) return { error: inError.message };

    void Promise.all([
      adjustAccountBalance(supabase, payment.id, -input.amount),
      adjustAccountBalance(
        supabase,
        input.transfer_to_account_id,
        input.amount
      ),
    ]);

    return { success: true };
  }

  // Parcelamento
  if (input.is_installment && input.total_installments && input.total_installments > 1) {
    const groupId = randomUUID();
    const installmentAmount =
      Math.round((input.amount / input.total_installments) * 100) / 100;
    const startDate = new Date(input.transaction_date + "T12:00:00");
    const rows = [];

    for (let i = 1; i <= input.total_installments; i++) {
      const date = addMonths(startDate, i - 1);
      const isFirst = i === 1;
      // Ajusta centavos na última parcela
      let amount = installmentAmount;
      if (i === input.total_installments) {
        amount =
          Math.round((input.amount - installmentAmount * (input.total_installments - 1)) * 100) /
          100;
      }

      rows.push({
        workspace_id: member.workspace_id,
        created_by_member_id: member.id,
        paid_by_member_id: input.paid_by_member_id || member.id,
        consumer_member_id:
          input.consumer_member_id ||
          input.paid_by_member_id ||
          member.id,
        amount,
        currency: "BRL",
        transaction_type: input.transaction_type,
        description: `${input.description} (${i}/${input.total_installments})`,
        notes: input.notes || null,
        category_id: input.category_id || null,
        card_id,
        account_id,
        tags,
        third_party_id,
        loan_id,
        is_installment: true,
        installment_number: i,
        total_installments: input.total_installments,
        installment_group_id: groupId,
        transaction_date: toISODate(date),
        status: isFirst ? "confirmed" : "scheduled",
        paid_at: isFirst ? new Date().toISOString() : null,
      });
    }

    const { error } = await supabase.from("transactions").insert(rows);
    if (error) return { error: error.message };

    if (account_id) {
      void adjustAccountBalance(
        supabase,
        account_id,
        accountBalanceDelta(input.transaction_type, input.amount)
      );
    }

    return { success: true };
  }

  const { error } = await supabase.from("transactions").insert({
    workspace_id: member.workspace_id,
    created_by_member_id: member.id,
    paid_by_member_id: input.paid_by_member_id || member.id,
    consumer_member_id:
      input.consumer_member_id ||
      input.paid_by_member_id ||
      member.id,
    amount: input.amount,
    currency: "BRL",
    transaction_type: input.transaction_type,
    description: input.description,
    notes: input.notes || null,
    category_id: input.category_id || null,
    card_id,
    account_id,
    tags,
    third_party_id,
    loan_id,
    transaction_date: input.transaction_date,
    status: "confirmed",
    paid_at: new Date().toISOString(),
  });

  if (error) return { error: error.message };

  if (account_id) {
    void adjustAccountBalance(
      supabase,
      account_id,
      accountBalanceDelta(input.transaction_type, input.amount)
    );
  }

  return { success: true };
}

export async function deleteTransactionAction(transactionId: string) {
  const member = await requireMember();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("transactions")
    .select(
      "id, amount, transaction_type, account_id, transfer_to_account_id, status"
    )
    .eq("id", transactionId)
    .eq("workspace_id", member.workspace_id)
    .maybeSingle();

  const { error } = await supabase
    .from("transactions")
    .update({ status: "cancelled" })
    .eq("id", transactionId)
    .eq("workspace_id", member.workspace_id);
  if (error) return { error: error.message };

  if (
    existing &&
    existing.status !== "cancelled" &&
    existing.account_id &&
    existing.status !== "scheduled"
  ) {
    if (
      existing.transaction_type === "transfer" &&
      existing.transfer_to_account_id
    ) {
      void Promise.all([
        adjustAccountBalance(
          supabase,
          existing.account_id,
          Number(existing.amount)
        ),
        adjustAccountBalance(
          supabase,
          existing.transfer_to_account_id,
          -Number(existing.amount)
        ),
      ]);
    } else if (existing.transaction_type !== "transfer") {
      void adjustAccountBalance(
        supabase,
        existing.account_id,
        -accountBalanceDelta(
          existing.transaction_type,
          Number(existing.amount)
        )
      );
    }
  }

  return { success: true };
}
