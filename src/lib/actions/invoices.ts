"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/supabase/workspace";

const payInvoiceSchema = z.object({
  cardId: z.string().uuid(),
  accountId: z.string().uuid(),
  amount: z.number().positive("Informe um valor maior que zero"),
  cycleKey: z.string().min(1),
  cycleFrom: z.string().min(1),
  cycleTo: z.string().min(1),
  cardName: z.string().min(1),
  paymentDate: z.string().min(1),
  notes: z.string().max(500).optional(),
});

export type PayInvoiceInput = z.infer<typeof payInvoiceSchema>;

/**
 * Registra pagamento (parcial ou total) da fatura do cartão.
 * Debita a conta; não entra como compra do cartão.
 */
export async function payInvoiceAction(raw: PayInvoiceInput) {
  const parsed = payInvoiceSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const member = await requireMember();
  const supabase = await createClient();
  const input = parsed.data;

  const { data: account, error: accError } = await supabase
    .from("accounts")
    .select("id, name, is_active")
    .eq("id", input.accountId)
    .eq("workspace_id", member.workspace_id)
    .maybeSingle();

  if (accError || !account || !account.is_active) {
    return { error: "Conta inválida ou inativa" };
  }

  const { data: card, error: cardError } = await supabase
    .from("cards")
    .select("id, name")
    .eq("id", input.cardId)
    .eq("workspace_id", member.workspace_id)
    .maybeSingle();

  if (cardError || !card) {
    return { error: "Cartão não encontrado" };
  }

  const description = `Pagamento fatura ${input.cardName} · ${input.cycleKey}`;
  const tags = [
    "invoice_payment",
    `invoice_card:${input.cardId}`,
    `invoice_cycle:${input.cycleKey}`,
  ];

  const { error: txError } = await supabase.from("transactions").insert({
    workspace_id: member.workspace_id,
    created_by_member_id: member.id,
    paid_by_member_id: member.id,
    consumer_member_id: member.id,
    amount: input.amount,
    currency: "BRL",
    transaction_type: "expense",
    description,
    notes:
      input.notes?.trim() ||
      `Ciclo ${input.cycleFrom} → ${input.cycleTo} · ${account.name}`,
    account_id: input.accountId,
    card_id: null,
    transaction_date: input.paymentDate,
    status: "confirmed",
    paid_at: new Date().toISOString(),
    tags,
  });

  if (txError) return { error: txError.message };

  // Atualiza saldo da conta se houver current_balance
  const { data: accFull } = await supabase
    .from("accounts")
    .select("current_balance")
    .eq("id", input.accountId)
    .maybeSingle();

  if (accFull?.current_balance != null) {
    await supabase
      .from("accounts")
      .update({
        current_balance: Number(accFull.current_balance) - input.amount,
      })
      .eq("id", input.accountId);
  }

  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  revalidatePath("/accounts");
  return { success: true };
}
