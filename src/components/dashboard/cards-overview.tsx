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
import { getBankColor } from "@/lib/utils/banks";

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
      <div className="mt-6 px-5 md:px-6">
        <h3 className="mb-3 text-[17px] font-semibold tracking-tight text-[var(--color-text)]">
          Cartões
        </h3>
        <div className="h-28 animate-pulse rounded-[14px] bg-[var(--color-chip)]" />
      </div>
    );
  }

  if (activeCards.length === 0) {
    return (
      <div className="mt-6 px-5 md:px-6">
        <div className="mb-3 flex items-end justify-between gap-2">
          <h3 className="text-[17px] font-semibold tracking-tight text-[var(--color-text)]">
            Cartões
          </h3>
          <Link
            href="/cards"
            className="text-[13px] font-medium text-[var(--color-text-2)] hover:text-[var(--color-text)]"
          >
            Gerenciar
          </Link>
        </div>
        <Link
          href="/cards"
          className="flex items-center gap-3 rounded-[14px] border border-dashed border-[var(--color-line)] bg-[var(--color-card)] px-4 py-5 transition-colors hover:border-[var(--color-text-2)]"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-chip)]">
            <CreditCard className="h-4 w-4 text-[var(--color-text)]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-medium text-[var(--color-text)]">
              Adicionar cartão
            </p>
            <p className="text-xs text-[var(--color-text-2)]">
              Limite, fatura e compras no dashboard
            </p>
          </div>
          <ChevronRight size={16} className="text-[var(--color-text-3)]" />
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-6 px-5 md:px-6">
      <div className="mb-3 flex items-end justify-between gap-2">
        <div>
          <h3 className="text-[17px] font-semibold tracking-tight text-[var(--color-text)]">
            Cartões
          </h3>
          <p className="mt-0.5 text-xs text-[var(--color-text-2)]">
            Ciclo atual · limite com parcelas
          </p>
        </div>
        <Link
          href="/cards"
          className="text-[13px] font-medium text-[var(--color-text-2)] transition-colors hover:text-[var(--color-text)]"
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
            return (
              <div
                key={card.id}
                className="overflow-hidden rounded-[14px] border border-[var(--color-line)] bg-[var(--color-card)]"
              >
                <div
                  className="h-1.5"
                  style={{
                    backgroundColor: card.bank
                      ? getBankColor(card.bank)
                      : card.color || "var(--color-text)",
                  }}
                />
                <div className="p-3.5">
                  <Link
                    href={`/cards/${card.id}`}
                    className="mb-3 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-medium text-[var(--color-text)]">
                        {card.name}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[var(--color-text-2)]">
                        {cycle?.label ?? "Ciclo da fatura"}
                        {card.last_four ? ` · ••${card.last_four}` : ""}
                      </p>
                    </div>
                    <ChevronRight
                      size={16}
                      className="mt-1 shrink-0 text-[var(--color-text-3)]"
                    />
                  </Link>

                  <div className="mb-2.5 grid grid-cols-3 gap-2">
                    <Metric
                      label="Neste ciclo"
                      value={formatCurrency(cycleSpend)}
                      muted={txLoading}
                    />
                    <Metric
                      label="Parcelas"
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

                  {usedPct != null && (
                    <div className="mb-1">
                      <div className="mb-1 flex items-center justify-between text-[10px] text-[var(--color-text-2)]">
                        <span>Comprometido</span>
                        <span className="font-mono">{usedPct}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-chip)]">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-300",
                            usedPct >= 90 ? "bg-[#EF4444]" : ""
                          )}
                          style={{
                            width: `${usedPct}%`,
                            backgroundColor:
                              usedPct >= 90
                                ? undefined
                                : card.bank
                                  ? getBankColor(card.bank)
                                  : undefined,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {recent.length > 0 ? (
                    <ul className="mt-3 space-y-1.5 border-t border-[var(--color-line)] pt-3">
                      {recent.map((tx) => (
                        <li key={tx.id}>
                          <Link
                            href={`/transactions/${tx.id}`}
                            className="flex items-center justify-between gap-2 text-[12px] transition-colors hover:text-[var(--color-text)]"
                          >
                            <span className="min-w-0 truncate text-[var(--color-text-2)]">
                              {formatDate(tx.transaction_date)} ·{" "}
                              {tx.description}
                              {tx.is_installment &&
                              tx.installment_number &&
                              tx.total_installments
                                ? ` (${tx.installment_number}/${tx.total_installments})`
                                : ""}
                            </span>
                            <span className="shrink-0 font-mono text-[#EF4444]">
                              {formatCurrency(Number(tx.amount))}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    !txLoading && (
                      <p className="mt-2 text-[11px] text-[var(--color-text-3)]">
                        Nenhuma compra neste ciclo
                      </p>
                    )
                  )}
                </div>
              </div>
            );
          }
        )}
      </div>
    </div>
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
    <div className="rounded-xl bg-[var(--color-chip)] px-2.5 py-2">
      <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-2)]">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 font-mono text-[12px] font-medium sm:text-[13px]",
          muted && "text-[var(--color-text-3)]",
          !muted && emphasis === "warn" && "text-[#EF4444]",
          !muted && emphasis === "ok" && "text-[var(--color-text)]",
          !muted && !emphasis && "text-[var(--color-text)]"
        )}
      >
        {value}
      </p>
    </div>
  );
}
