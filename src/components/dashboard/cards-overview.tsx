"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, CreditCard } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useCards } from "@/lib/hooks/use-finance";
import type { WorkspaceMember } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import {
  cardAvailableLimit,
  getCurrentInvoiceCycle,
  sumCardCommittedLimit,
  type CardCycleTx,
} from "@/lib/finance/card-cycle";
import { cn } from "@/lib/utils";

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

  const { data: cardTx = [], isLoading: txLoading } = useQuery({
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
      // Ciclo atual + parcelas futuras (scheduled) p/ compromisso de limite
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
        .not("card_id", "is", null)
        .neq("status", "cancelled")
        .or(
          `status.eq.scheduled,and(transaction_date.gte.${range.from},transaction_date.lte.${range.to})`
        )
        .order("transaction_date", { ascending: false })
        .limit(1500);
      if (error) throw error;
      return (data ?? []) as CardCycleTx[];
    },
  });

  const rows = useMemo(() => {
    return activeCards.map((card) => {
      const cycle = cyclesByCard.get(card.id) ?? null;
      const txs = cardTx.filter((t) => t.card_id === card.id);
      const { cycleSpend, futureCommitted, committed } = sumCardCommittedLimit(
        txs,
        cycle
      );
      const limit =
        card.credit_limit != null ? Number(card.credit_limit) : null;
      const available = cardAvailableLimit(limit, committed);
      const usedPct =
        limit != null && limit > 0
          ? Math.min(100, Math.round((committed / limit) * 100))
          : null;
      const recent = cycle
        ? txs
            .filter(
              (t) =>
                t.transaction_date >= cycle.from &&
                t.transaction_date <= cycle.to &&
                t.transaction_type !== "income"
            )
            .slice(0, 3)
        : [];
      return {
        card,
        cycle,
        cycleSpend,
        futureCommitted,
        committed,
        limit,
        available,
        usedPct,
        recent,
      };
    });
  }, [activeCards, cardTx, cyclesByCard]);
  if (cardsLoading) {
    return (
      <div className="px-5 mt-6">
        <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-white/60">
          Cartões
        </h3>
        <div className="h-28 animate-pulse rounded-2xl bg-white/[0.04]" />
      </div>
    );
  }

  if (activeCards.length === 0) {
    return (
      <div className="px-5 mt-6">
        <div className="mb-3 flex items-end justify-between gap-2">
          <h3 className="text-[13px] font-semibold uppercase tracking-wider text-white/60">
            Cartões
          </h3>
          <Link
            href="/cards"
            className="text-xs font-medium text-white/35 hover:text-white/55"
          >
            Gerenciar
          </Link>
        </div>
        <Link
          href="/cards"
          className="flex items-center gap-3 rounded-2xl border border-dashed border-white/[0.1] bg-white/[0.02] px-4 py-5 transition-colors hover:border-white/[0.18]"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15">
            <CreditCard className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-medium text-white/80">
              Adicionar cartão
            </p>
            <p className="text-xs text-white/30">
              Limite, fatura e compras no dashboard
            </p>
          </div>
          <ChevronRight size={16} className="text-white/25" />
        </Link>
      </div>
    );
  }

  return (
    <div className="px-5 mt-6">
      <div className="mb-3 flex items-end justify-between gap-2">
        <div>
          <h3 className="text-[13px] font-semibold uppercase tracking-wider text-white/60">
            Cartões
          </h3>
          <p className="mt-0.5 text-xs text-white/30">
            Ciclo atual da fatura · limite com parcelas
          </p>
        </div>
        <Link
          href="/cards"
          className="text-xs font-medium text-white/35 hover:text-white/55"
        >
          Ver todos
        </Link>
      </div>

      <div className="flex flex-col gap-2.5">
        {rows.map(
          ({
            card,
            cycle,
            cycleSpend,
            futureCommitted,
            limit,
            available,
            usedPct,
            recent,
          }) => {
            const color = card.color || "#6366F1";
            return (
              <div
                key={card.id}
                className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#111113]"
              >
                <div className="h-1" style={{ backgroundColor: color }} />
                <div className="p-4">
                  <Link
                    href={`/cards/${card.id}`}
                    className="mb-3 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold text-white/90">
                        {card.name}
                      </p>
                      <p className="mt-0.5 text-[11px] text-white/35">
                        {cycle?.label ?? "Ciclo da fatura"}
                        {card.last_four ? ` · ••${card.last_four}` : ""}
                      </p>
                    </div>
                    <ChevronRight
                      size={16}
                      className="mt-1 shrink-0 text-white/25"
                    />
                  </Link>

                  <div className="mb-3 grid grid-cols-3 gap-2">
                    <Metric
                      label="Neste ciclo"
                      value={formatCurrency(cycleSpend)}
                      muted={txLoading}
                    />
                    <Metric
                      label="Parcelas a vencer"
                      value={
                        futureCommitted > 0
                          ? formatCurrency(futureCommitted)
                          : "—"
                      }
                      muted={txLoading}
                    />
                    <Metric
                      label="Disponível"
                      value={
                        available != null ? formatCurrency(available) : "—"
                      }
                      emphasis={
                        available != null && limit != null
                          ? available / limit < 0.2
                            ? "warn"
                            : "ok"
                          : undefined
                      }
                    />
                  </div>

                  {limit != null && (
                    <p className="mb-2 text-[10px] text-white/25">
                      Limite {formatCurrency(limit)}
                      {futureCommitted > 0
                        ? " · disponível já desconta parcelas futuras"
                        : ""}
                    </p>
                  )}

                  {usedPct != null && (
                    <div className="mb-2">
                      <div className="mb-1 flex items-center justify-between text-[10px] text-white/30">
                        <span>Limite comprometido</span>
                        <span className="font-mono">{usedPct}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${usedPct}%`,
                            backgroundColor:
                              usedPct >= 90
                                ? "#EF4444"
                                : usedPct >= 70
                                  ? "#F59E0B"
                                  : color,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {recent.length > 0 ? (
                    <ul className="mt-3 space-y-1.5 border-t border-white/[0.05] pt-3">
                      {recent.map((tx) => (
                        <li key={tx.id}>
                          <Link
                            href={`/transactions/${tx.id}`}
                            className="flex items-center justify-between gap-2 text-[12px] transition-colors hover:text-white/80"
                          >
                            <span className="min-w-0 truncate text-white/55">
                              {formatDate(tx.transaction_date)} ·{" "}
                              {tx.description}
                              {tx.is_installment &&
                              tx.installment_number &&
                              tx.total_installments
                                ? ` (${tx.installment_number}/${tx.total_installments})`
                                : ""}
                            </span>
                            <span className="shrink-0 font-mono text-white/70">
                              {formatCurrency(Number(tx.amount))}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    !txLoading && (
                      <p className="mt-2 text-[11px] text-white/25">
                        Nenhuma compra neste ciclo
                      </p>
                    )
                  )}

                  <div className="mt-3 flex gap-4 text-[11px]">
                    <Link
                      href={`/cards/${card.id}`}
                      className="font-medium text-white/40 hover:text-white/65"
                    >
                      Detalhes
                    </Link>
                    <Link
                      href="/invoices"
                      className="font-medium text-white/40 hover:text-white/65"
                    >
                      Fatura
                    </Link>
                  </div>
                </div>
              </div>
            );
          }
        )}
      </div>    </div>
  );
}

function Metric({
  label,
  value,
  muted,
  emphasis,
}: {
  label: string;
  value: string;
  muted?: boolean;
  emphasis?: "ok" | "warn";
}) {
  return (
    <div className="rounded-xl bg-white/[0.03] px-2.5 py-2">
      <p className="text-[10px] uppercase tracking-wide text-white/30">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 font-mono text-[13px] font-semibold",
          muted && "text-white/40",
          !muted && emphasis === "warn" && "text-amber-400",
          !muted && emphasis === "ok" && "text-emerald-400/90",
          !muted && !emphasis && "text-white/85"
        )}
      >
        {value}
      </p>
    </div>
  );
}
