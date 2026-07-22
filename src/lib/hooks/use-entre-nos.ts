"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useWorkspaceMembers } from "@/lib/hooks/use-finance";
import {
  computeEntreNosSettlement,
  type EntreNosTx,
} from "@/lib/finance/entre-nos";
import { isSharedWorkspace } from "@/lib/utils/workspace";
import {
  endOfMonth,
  startOfMonth,
  toISODate,
} from "@/lib/utils/format";
import type { WorkspaceMember } from "@/types";

const REMINDER_DAYS = 7;

/** Dívida / lembrete do mês civil atual (não acumula meses anteriores). */
export function useEntreNosDebt(member: WorkspaceMember | null | undefined) {
  const workspaceId = member?.workspace_id;
  const shared = isSharedWorkspace(member?.workspace?.type);
  const { data: members = [] } = useWorkspaceMembers(workspaceId ?? "");

  const now = new Date();
  const from = toISODate(startOfMonth(now));
  const to = toISODate(endOfMonth(now));

  const query = useQuery({
    queryKey: ["entre-nos", workspaceId, from, to],
    enabled: Boolean(workspaceId && shared),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("transactions")
        .select(
          `
          id, amount, description, transaction_type, paid_by_member_id,
          consumer_member_id, consumer_share_percent, transaction_date,
          category:categories(icon, name),
          card:cards!card_id(id, name, owner_member_id),
          account:accounts!account_id(id, name, owner_member_id)
        `
        )
        .eq("workspace_id", workspaceId!)
        .in("transaction_type", ["expense", "loan_given", "settlement"])
        .neq("status", "cancelled")
        .gte("transaction_date", from)
        .lte("transaction_date", to)
        .order("transaction_date", { ascending: false })
        .limit(500);
      if (error) throw new Error(error.message);
      return (data ?? []) as EntreNosTx[];
    },
  });

  const settlement = (() => {
    if (!shared || members.length < 2 || !query.data) return null;
    return computeEntreNosSettlement(
      members.map((m) => ({ id: m.id, display_name: m.display_name })),
      query.data
    );
  })();

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
