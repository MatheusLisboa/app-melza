"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useWorkspaceMembers } from "@/lib/hooks/use-finance";
import {
  ENTRE_NOS_TX_SELECT,
  computeEntreNosSettlement,
  entreNosMonthQueryRange,
  filterEntreNosTxsForMonth,
  type EntreNosTx,
} from "@/lib/finance/entre-nos";
import { isSharedWorkspace } from "@/lib/utils/workspace";
import { startOfMonth } from "@/lib/utils/format";
import type { WorkspaceMember } from "@/types";

const REMINDER_DAYS = 7;

/** Dívida / lembrete do mês atual (cartão pelo ciclo de fechamento). */
export function useEntreNosDebt(member: WorkspaceMember | null | undefined) {
  const workspaceId = member?.workspace_id;
  const shared = isSharedWorkspace(member?.workspace?.type);
  const { data: members = [] } = useWorkspaceMembers(workspaceId ?? "");

  const monthKey = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  })();

  const query = useQuery({
    queryKey: ["entre-nos", workspaceId, monthKey],
    enabled: Boolean(workspaceId && shared),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const supabase = createClient();
      const range = entreNosMonthQueryRange(startOfMonth(new Date()));
      const { data, error } = await supabase
        .from("transactions")
        .select(ENTRE_NOS_TX_SELECT)
        .eq("workspace_id", workspaceId!)
        .in("transaction_type", ["expense", "loan_given", "settlement"])
        .neq("status", "cancelled")
        .gte("transaction_date", range.from)
        .lte("transaction_date", range.to)
        .order("transaction_date", { ascending: false })
        .limit(500);
      if (error) throw new Error(error.message);
      return (data ?? []) as EntreNosTx[];
    },
  });

  const settlement = useMemo(() => {
    if (!shared || members.length < 2 || !query.data) return null;
    const txs = filterEntreNosTxsForMonth(
      query.data,
      startOfMonth(new Date())
    );
    return computeEntreNosSettlement(
      members.map((m) => ({ id: m.id, display_name: m.display_name })),
      txs
    );
  }, [shared, members, query.data]);

  const hasDebt = Boolean(
    settlement && !settlement.balanced && settlement.netAmount >= 1
  );

  let daysOpen = 0;
  if (hasDebt && settlement?.oldestOpenDate) {
    const then = new Date(settlement.oldestOpenDate + "T12:00:00");
    const today = new Date();
    daysOpen = Math.max(
      0,
      Math.floor((today.getTime() - then.getTime()) / 86_400_000)
    );
  }

  return {
    settlement,
    hasDebt,
    netAmount: settlement?.netAmount ?? 0,
    daysOpen,
    showReminder: hasDebt && daysOpen >= REMINDER_DAYS,
    reminderDays: REMINDER_DAYS,
    isLoading: query.isLoading,
    members,
  };
}
