"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/supabase/workspace";
import {
  loanRepaymentSchema,
  loanSchema,
  subscriptionSchema,
  type LoanInput,
  type LoanRepaymentInput,
  type SubscriptionInput,
} from "@/lib/validations/subscriptions-loans";
import { parsePaymentMethod } from "@/lib/utils/payment-method";
import { addMonths, toISODate } from "@/lib/utils/format";

export async function createSubscriptionAction(raw: SubscriptionInput) {
  const parsed = subscriptionSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const member = await requireMember();
  const supabase = await createClient();
  const input = parsed.data;

  const { error } = await supabase.from("subscriptions").insert({
    workspace_id: member.workspace_id,
    name: input.name,
    amount: input.amount,
    billing_cycle: input.billing_cycle,
    next_billing_date: input.next_billing_date || null,
    card_id: input.card_id || null,
    account_id: input.account_id || null,
    category_id: input.category_id || null,
    notes: input.notes || null,
    is_active: true,
  });

  if (error) return { error: error.message };
  revalidatePath("/subscriptions");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function toggleSubscriptionAction(id: string, isActive: boolean) {
  const member = await requireMember();
  const supabase = await createClient();
  const { error } = await supabase
    .from("subscriptions")
    .update({ is_active: isActive })
    .eq("id", id)
    .eq("workspace_id", member.workspace_id);
  if (error) return { error: error.message };
  revalidatePath("/subscriptions");
  return { success: true };
}

/**
 * Marca assinatura como paga neste ciclo:
 * cria lançamento + avança next_billing_date.
 */
export async function paySubscriptionAction(subscriptionId: string) {
  const member = await requireMember();
  const supabase = await createClient();

  const { data: sub, error: subError } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("id", subscriptionId)
    .eq("workspace_id", member.workspace_id)
    .single();

  if (subError || !sub) {
    return { error: subError?.message ?? "Assinatura não encontrada" };
  }
  if (!sub.is_active) {
    return { error: "Assinatura inativa" };
  }
  if (!sub.card_id && !sub.account_id) {
    return { error: "Defina cartão ou conta na assinatura antes de pagar" };
  }

  const payDate = sub.next_billing_date
    ? sub.next_billing_date
    : toISODate(new Date());

  const { error: txError } = await supabase.from("transactions").insert({
    workspace_id: member.workspace_id,
    created_by_member_id: member.id,
    paid_by_member_id: member.id,
    consumer_member_id: member.id,
    amount: Number(sub.amount),
    currency: sub.currency || "BRL",
    transaction_type: "expense",
    description: sub.name,
    notes: sub.notes,
    category_id: sub.category_id,
    card_id: sub.card_id,
    account_id: sub.account_id,
    subscription_id: sub.id,
    is_recurring: true,
    transaction_date: payDate,
    status: "confirmed",
    paid_at: new Date().toISOString(),
  });

  if (txError) return { error: txError.message };

  const base = sub.next_billing_date
    ? new Date(sub.next_billing_date + "T12:00:00")
    : new Date();
  let next = new Date(base);
  if (sub.billing_cycle === "yearly") {
    next = addMonths(base, 12);
  } else if (sub.billing_cycle === "weekly") {
    next = new Date(base);
    next.setDate(next.getDate() + 7);
  } else {
    next = addMonths(base, 1);
  }

  const { error: updError } = await supabase
    .from("subscriptions")
    .update({ next_billing_date: toISODate(next) })
    .eq("id", sub.id)
    .eq("workspace_id", member.workspace_id);

  if (updError) return { error: updError.message };

  revalidatePath("/subscriptions");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/invoices");
  return { success: true, next_billing_date: toISODate(next) };
}

export async function createLoanAction(raw: LoanInput) {
  const parsed = loanSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const member = await requireMember();
  const supabase = await createClient();
  const input = parsed.data;

  let third_party_id: string;
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

  const { data: loan, error: loanError } = await supabase
    .from("loans")
    .insert({
      workspace_id: member.workspace_id,
      third_party_id,
      direction: input.direction,
      original_amount: input.original_amount,
      paid_amount: 0,
      description: input.description || null,
      due_date: input.due_date || null,
      status: "open",
    })
    .select("id")
    .single();

  if (loanError) return { error: loanError.message };

  // Lançamento inicial opcional se houver meio de pagamento
  if (input.payment_method) {
    const payment = parsePaymentMethod(input.payment_method);
    if (payment) {
      const { error: txError } = await supabase.from("transactions").insert({
        workspace_id: member.workspace_id,
        created_by_member_id: member.id,
        paid_by_member_id: member.id,
        amount: input.original_amount,
        currency: "BRL",
        transaction_type:
          input.direction === "given" ? "loan_given" : "loan_received",
        description:
          input.description ||
          (input.direction === "given"
            ? `Empréstimo a ${input.third_party_name}`
            : `Empréstimo de ${input.third_party_name}`),
        card_id: payment.kind === "card" ? payment.id : null,
        account_id: payment.kind === "account" ? payment.id : null,
        third_party_id,
        loan_id: loan.id,
        transaction_date: new Date().toISOString().slice(0, 10),
        status: "confirmed",
        paid_at: new Date().toISOString(),
      });
      if (txError) return { error: txError.message };
    }
  }

  revalidatePath("/loans");
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  return { success: true };
}

export async function repayLoanAction(raw: LoanRepaymentInput) {
  const parsed = loanRepaymentSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const member = await requireMember();
  const supabase = await createClient();
  const input = parsed.data;
  const payment = parsePaymentMethod(input.payment_method);
  if (!payment) return { error: "Meio de pagamento inválido" };

  const { data: loan, error: loanFetchError } = await supabase
    .from("loans")
    .select("*")
    .eq("id", input.loan_id)
    .eq("workspace_id", member.workspace_id)
    .single();

  if (loanFetchError || !loan) return { error: "Empréstimo não encontrado" };

  const remaining =
    Number(loan.original_amount) - Number(loan.paid_amount);
  if (input.amount > remaining + 0.001) {
    return { error: `Valor maior que o saldo (${remaining.toFixed(2)})` };
  }

  const newPaid = Number(loan.paid_amount) + input.amount;
  const status =
    newPaid >= Number(loan.original_amount) - 0.001
      ? "paid"
      : newPaid > 0
        ? "partial"
        : "open";

  const { error: txError } = await supabase.from("transactions").insert({
    workspace_id: member.workspace_id,
    created_by_member_id: member.id,
    paid_by_member_id: member.id,
    amount: input.amount,
    currency: "BRL",
    transaction_type: "loan_repayment",
    description: `Pagamento empréstimo: ${loan.description || "sem descrição"}`,
    notes: input.notes || null,
    card_id: payment.kind === "card" ? payment.id : null,
    account_id: payment.kind === "account" ? payment.id : null,
    third_party_id: loan.third_party_id,
    loan_id: loan.id,
    transaction_date: input.transaction_date,
    status: "confirmed",
    paid_at: new Date().toISOString(),
  });
  if (txError) return { error: txError.message };

  const { error: updateError } = await supabase
    .from("loans")
    .update({ paid_amount: newPaid, status })
    .eq("id", loan.id);
  if (updateError) return { error: updateError.message };

  revalidatePath("/loans");
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  return { success: true, status };
}
