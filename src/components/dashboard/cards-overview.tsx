"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CreditCard } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useCards } from "@/lib/hooks/use-finance";
import type { WorkspaceMember } from "@/types";
import {
  cardAvailableLimit,
  getCurrentInvoiceCycle,
  sumCardCommittedLimit,
  type CardCycleTx,
} from "@/lib/finance/card-cycle";
import { EmptyState, PhysicalCard } from "@/components/design-system";

export function DashboardCardsSection({
  member,
}: {
  member: WorkspaceMember;
}) {
  const { data: cards = [], isLoading: cardsLoading } = useCards(
    member.workspace_id
  );

  const activeCards = useMemo(
    () => cards.filter((c) => c.is_active),
    [cards]
  );

  const cyclesByCard = useMemo(() => {
    const map = new Map<
      string,
      NonNullable<ReturnType<typeof getCurrentInvoiceCycle>>
    >();
    for (const card of activeCards) {
      const cycle = getCurrentInvoiceCycle(card);
      if (cycle) map.set(card.id, cycle);
    }
    return map;
  }, [activeCards]);

  const range = useMemo(() => {
    let from = "";
    let to = "";
    for (const cycle of Array.from(cyclesByCard.values())) {
      if (!from || cycle.from < from) from = cycle.from;
      if (!to || cycle.to > to) to = cycle.to;
    }
    return { from, to };
  }, [cyclesByCard]);

  const { data: cardTx = [] } = useQuery({
    queryKey: [
      "dashboard",
      "card-cycles",
      member.workspace_id,
      range.from,
      range.to,
    ],
    enabled: activeCards.length > 0 && Boolean(range.from && range.to),
    staleTime: 30_000,
    queryFn: async () => {
      const supabase = createClient();
      const cardIds = activeCards.map((c) => c.id);
      const { data, error } = await supabase
        .from("transactions")
        .select(
          `
          id, amount, transaction_type, status, card_id, description,
          transaction_date, is_installment, installment_number,
          total_installments, installment_group_id
        `
        )
        .eq("workspace_id", member.workspace_id)
        .in("card_id", cardIds)
        .neq("status", "cancelled")
        .or(
          `status.eq.scheduled,and(transaction_date.gte.${range.from},transaction_date.lte.${range.to})`
        )
        .order("transaction_date", { ascending: false })
        .limit(600);
      if (error) throw error;
      return (data ?? []) as CardCycleTx[];
    },
  });

  const rows = useMemo(() => {
    return activeCards.map((card) => {
      const cycle = cyclesByCard.get(card.id) ?? null;
      const txs = cardTx.filter((t) => t.card_id === card.id);
      const { committed } = sumCardCommittedLimit(txs, cycle);
      const limit =
        card.credit_limit != null ? Number(card.credit_limit) : null;
      const available = cardAvailableLimit(limit, committed);
      const usedPct =
        limit != null && limit > 0
          ? Math.min(100, Math.round((committed / limit) * 100))
          : null;
      return { card, cycle, available, usedPct };
    });
  }, [activeCards, cardTx, cyclesByCard]);

  if (cardsLoading) {
    return (
      <div className="mt-5">
        <div className="h-[160px] animate-pulse rounded-[18px] bg-[var(--color-chip)]" />
      </div>
    );
  }

  if (activeCards.length === 0) {
    return (
      <div className="mt-5">
        <EmptyState
          scene="card"
          title="Nenhum cartão"
          description="Cadastre o cartão para ver limite e ciclo aqui."
          actionLabel="Adicionar cartão"
          onAction={() => {
            window.location.assign("/cards");
          }}
          className="rounded-[14px] border border-dashed border-[var(--color-line)] bg-[var(--color-card)] py-8"
        />
      </div>
    );
  }

  return (
    <div className="mt-5">
      <div className="mb-2.5 flex items-end justify-between px-5 md:px-6">
        <h3 className="text-title">Cartões</h3>
        <Link
          href="/cards"
          className="text-[13px] font-medium text-[var(--color-text-2)] hover:text-[var(--color-text)]"
        >
          Ver todos
        </Link>
      </div>
      <div className="scroll-fade-x flex gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] snap-x snap-mandatory md:px-6 [&::-webkit-scrollbar]:hidden">
        {rows.map(({ card, cycle, available, usedPct }) => (
          <PhysicalCard
            key={card.id}
            href={`/cards/${card.id}`}
            name={card.name}
            bank={card.bank}
            lastFour={card.last_four}
            available={available}
            cycleLabel={cycle?.label}
            usedPct={usedPct}
          />
        ))}
        <Link
          href="/cards"
          className="flex aspect-[1.62/1] w-[160px] shrink-0 snap-center flex-col items-center justify-center gap-2 rounded-[18px] border border-dashed border-[var(--color-line)] bg-[var(--color-card)] text-[12px] font-medium text-[var(--color-text-2)]"
        >
          <CreditCard size={18} />
          Novo
        </Link>
      </div>
    </div>
  );
}
