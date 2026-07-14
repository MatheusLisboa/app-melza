export interface BankOption {
  id: string;
  name: string;
  color: string;
}

export const BANKS: BankOption[] = [
  { id: "nubank", name: "Nubank", color: "#820AD1" },
  { id: "itau", name: "Itaú", color: "#EC7000" },
  { id: "santander", name: "Santander", color: "#EC0000" },
  { id: "bradesco", name: "Bradesco", color: "#CC092F" },
  { id: "inter", name: "Inter", color: "#FF7A00" },
  { id: "c6", name: "C6 Bank", color: "#1A1A1A" },
  { id: "xp", name: "XP", color: "#000000" },
  { id: "bb", name: "Banco do Brasil", color: "#FFCC29" },
  { id: "caixa", name: "Caixa", color: "#0070AF" },
  { id: "cash", name: "Dinheiro", color: "#22c55e" },
  { id: "other", name: "Outro", color: "#6366f1" },
];

export function getBankColor(bankId: string): string {
  return BANKS.find((b) => b.id === bankId)?.color ?? "#6366f1";
}

export function getBankName(bankId: string): string {
  return BANKS.find((b) => b.id === bankId)?.name ?? bankId;
}
