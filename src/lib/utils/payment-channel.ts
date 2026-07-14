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
