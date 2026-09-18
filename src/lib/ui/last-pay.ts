import type { PaymentChannel } from "@/lib/validations/transaction";

export type LastTxTemplate = {
  description: string;
  amount: number;
  payment_method: string;
  payment_channel?: PaymentChannel | null;
  category_id?: string | null;
  transaction_type?: string;
};

const KEY = (workspaceId: string) => `melza-tx-templates:${workspaceId}`;
const MAX = 4;

export function loadTxTemplates(workspaceId: string): LastTxTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY(workspaceId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LastTxTemplate[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((t) => t.description && t.amount > 0).slice(0, MAX);
  } catch {
    return [];
  }
}

export function saveTxTemplate(workspaceId: string, item: LastTxTemplate) {
  if (typeof window === "undefined") return;
  try {
    const prev = loadTxTemplates(workspaceId).filter(
      (t) => t.description.toLowerCase() !== item.description.toLowerCase()
    );
    localStorage.setItem(KEY(workspaceId), JSON.stringify([item, ...prev].slice(0, MAX)));
  } catch {
    /* quota */
  }
}
