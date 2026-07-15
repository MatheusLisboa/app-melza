import type { QueryClient } from "@tanstack/react-query";

const FINANCE_ROOTS = new Set([
  "dashboard",
  "transactions",
  "invoices",
  "invoice-payments",
  "accounts",
  "reports",
  "transaction",
  "cards",
  "card",
  "card-cycles",
  "subscriptions",
  "loans",
  "entre-nos",
  "categories",
]);

/**
 * Marca dados financeiros como stale e refetch em background.
 * Não bloqueia a UI — chame com `void invalidateFinanceQueries(qc)`.
 */
export function invalidateFinanceQueries(qc: QueryClient): void {
  void qc.invalidateQueries({
    predicate: (q) => FINANCE_ROOTS.has(String(q.queryKey[0] ?? "")),
  });
}
