import type { QueryClient } from "@tanstack/react-query";

/** Atualiza cache do app após criar/editar/excluir lançamentos. */
export async function invalidateFinanceQueries(qc: QueryClient) {
  await Promise.all([
    qc.invalidateQueries({ queryKey: ["dashboard"] }),
    qc.invalidateQueries({ queryKey: ["transactions"] }),
    qc.invalidateQueries({ queryKey: ["invoices"] }),
    qc.invalidateQueries({ queryKey: ["accounts"] }),
    qc.invalidateQueries({ queryKey: ["reports"] }),
  ]);
  // força refetch imediato das queries do dashboard (staleTime global é 60s)
  await qc.refetchQueries({ queryKey: ["dashboard"], type: "active" });
}
