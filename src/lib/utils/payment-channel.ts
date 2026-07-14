import type { PaymentChannel } from "@/lib/validations/transaction";

const CHANNEL_TAGS = new Set(["pix", "cash", "card", "account"]);

export function tagsForPaymentChannel(
  channel: PaymentChannel | null | undefined
): string[] | null {
  if (!channel || channel === "card" || channel === "account") return null;
  return [channel];
}

export function paymentChannelFromTags(
  tags: string[] | null | undefined
): PaymentChannel | null {
  if (!tags?.length) return null;
  const hit = tags.find((t) => CHANNEL_TAGS.has(t));
  if (hit === "pix" || hit === "cash" || hit === "card" || hit === "account") {
    return hit;
  }
  return null;
}

export function paymentChannelLabel(
  channel: PaymentChannel | null | undefined
): string | null {
  if (!channel) return null;
  const map: Record<PaymentChannel, string> = {
    card: "Cartão",
    pix: "PIX",
    account: "Conta",
    cash: "Dinheiro",
  };
  return map[channel];
}

/** Infere a forma de pagamento a partir de tags + cartão/conta. */
export function resolvePaymentChannel(tx: {
  card_id?: string | null;
  account_id?: string | null;
  tags?: string[] | null;
}): PaymentChannel | null {
  const tagged = paymentChannelFromTags(tx.tags);
  if (tagged) return tagged;
  if (tx.card_id) return "card";
  if (tx.account_id) return "account";
  return null;
}

/** Rótulo curto para lista (ex.: "PIX · Nubank", "Cartão · Inter"). */
export function paymentMethodCaption(tx: {
  card_id?: string | null;
  account_id?: string | null;
  tags?: string[] | null;
  card?: { name?: string | null } | null;
  account?: { name?: string | null } | null;
}): string | null {
  const channel = resolvePaymentChannel(tx);
  if (!channel) return null;
  const base = paymentChannelLabel(channel)!;
  if (channel === "card" && tx.card?.name) return `${base} · ${tx.card.name}`;
  if (
    (channel === "pix" || channel === "account" || channel === "cash") &&
    tx.account?.name
  ) {
    return `${base} · ${tx.account.name}`;
  }
  return base;
}
