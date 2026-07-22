"use server";

import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/supabase/workspace";
import {
  settlementSchema,
  type SettlementInput,
} from "@/lib/validations/settlement";
import { adjustAccountBalance } from "@/lib/finance/account-balance";
import { tagsForPaymentChannel } from "@/lib/utils/payment-channel";
import { formatCurrency } from "@/lib/utils/format";

/**
 * Registra acerto Entre Nós (total ou parcial).
 * Semântica: from paga to → consumer=to, paid_by=from (reduz a dívida).
 */
export async function createSettlementAction(raw: SettlementInput) {
  const parsed = settlementSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const input = parsed.data;
  if (input.fromMemberId === input.toMemberId) {
    return { error: "Pagador e recebedor devem ser diferentes" };
  }
  if (!input.accountId) {
    return { error: "Selecione a conta de onde saiu o pagamento" };
  }

  const member = await requireMember();
  const supabase = await createClient();

  const { data: members, error: membersError } = await supabase
    .from("workspace_members")
    .select("id, display_name")
    .eq("workspace_id", member.workspace_id)
    .in("id", [input.fromMemberId, input.toMemberId]);

  if (membersError) return { error: membersError.message };
  if ((members ?? []).length !== 2) {
    return { error: "Membros inválidos neste workspace" };
  }

  const fromName =
    members!.find((m) => m.id === input.fromMemberId)?.display_name ?? "?";
  const toName =
    members!.find((m) => m.id === input.toMemberId)?.display_name ?? "?";

  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .eq("id", input.accountId)
    .eq("workspace_id", member.workspace_id)
    .maybeSingle();
  if (!account) return { error: "Conta inválida" };

  const channel = input.paymentChannel ?? "pix";
  const tags = [
    "entre_nos_settlement",
    ...(tagsForPaymentChannel(channel) ?? [channel]),
  ];

  const description = `Acerto Entre Nós: ${fromName} → ${toName} (${formatCurrency(input.amount)})`;

  const { data: created, error } = await supabase
    .from("transactions")
    .insert({
      workspace_id: member.workspace_id,
      created_by_member_id: member.id,
      paid_by_member_id: input.fromMemberId,
      consumer_member_id: input.toMemberId,
      amount: input.amount,
      currency: "BRL",
      transaction_type: "settlement",
      description,
      notes: input.notes?.trim() || null,
      account_id: input.accountId,
      card_id: null,
      tags,
      transaction_date: input.paymentDate,
      status: "confirmed",
      paid_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  void adjustAccountBalance(supabase, input.accountId, -input.amount);

  // Notifica o outro membro (quem recebe o acerto, se quem pagou registrou;
  // ou quem pagou, se quem recebeu registrou)
  const notifyMemberId =
    member.id === input.fromMemberId
      ? input.toMemberId
      : member.id === input.toMemberId
        ? input.fromMemberId
        : input.toMemberId;

  void (async () => {
    try {
      const { notifyMember } = await import("@/lib/push/notify");
      const actorName = member.display_name;
      await notifyMember(notifyMemberId, {
        title: "Acerto Entre Nós",
        body: `${actorName} registrou acerto de ${formatCurrency(input.amount)}`,
        url: "/entre-nos",
        tag: `settlement-${created.id}`,
      });
    } catch {
      /* push opcional */
    }
  })();

  return { success: true, id: created.id };
}
