export function encodePaymentMethod(kind: "card" | "account", id: string) {
  return `${kind}:${id}`;
}

export function parsePaymentMethod(
  value: string
): { kind: "card" | "account"; id: string } | null {
  const [kind, id] = value.split(":");
  if ((kind === "card" || kind === "account") && id) {
    return { kind, id };
  }
  return null;
}
