"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { parseAsString, useQueryState } from "nuqs";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  QrCode,
  Share2,
  Wallet,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useCards, useWorkspaceMembers } from "@/lib/hooks/use-finance";
import type { WorkspaceMember } from "@/types";
import {
  Avatar,
  Badge,
  Btn,
  Divider,
  DsSkeleton,
  EmptyState,
  MoneyDisplay,
  TopBar,
  toDsMember,
} from "@/components/design-system";
import {
  addMonths,
  endOfMonth,
  formatCurrency,
  formatDate,
  formatMonthYear,
  startOfMonth,
  toISODate,
} from "@/lib/utils/format";
import {
  ENTRE_NOS_TX_LIMIT,
  ENTRE_NOS_TX_SELECT,
  computeEntreNosSettlement,
  enrichEntreNosTxsWithCards,
  entreNosCardCycle,
  entreNosMonthQueryRange,
  filterEntreNosTxsByCard,
  filterEntreNosTxsForMonth,
  formatEntreNosCycleRange,
  type EntreNosCardFilter,
  type EntreNosTx,
} from "@/lib/finance/entre-nos";

const SettleEntreNosDialog = dynamic(
  () =>
    import("@/components/entre-nos/settle-dialog").then((m) => ({
      default: m.SettleEntreNosDialog,
    })),
  { ssr: false }
);

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function parseMonthKey(key: string): Date {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) return startOfMonth(new Date());
  return startOfMonth(new Date(y, m - 1, 1));
}

/** Data padrão do acerto: hoje se for o mês atual; senão o último dia do mês. */
function defaultSettleDate(month: Date): string {
  const today = new Date();
  if (monthKey(month) === monthKey(today)) return toISODate(today);
  return toISODate(endOfMonth(month));
}

/**
 * Entre Nós — acertos por mês / ciclo de fechamento do cartão.
 * Estado de mês e cartão na URL (?mes=YYYY-MM&cartao=id).
 */
export function EntreNosClient({ member }: { member: WorkspaceMember }) {
  const defaultMonth = monthKey(new Date());
  const [monthParam, setMonthParam] = useQueryState(
    "mes",
    parseAsString.withDefault(defaultMonth).withOptions({ history: "push" })
  );
  const [cardFilter, setCardFilter] = useQueryState(
    "cartao",
    parseAsString.withDefault("all").withOptions({ history: "replace" })
  );
  const [showDebtDetail, setShowDebtDetail] = useState(false);
  const [settleOpen, setSettleOpen] = useState(false);
  const { data: members = [] } = useWorkspaceMembers(member.workspace_id);
  const { data: cards = [] } = useCards(member.workspace_id);

  const month = useMemo(() => parseMonthKey(monthParam), [monthParam]);
  const setMonth = (next: Date | ((prev: Date) => Date)) => {
    const value = typeof next === "function" ? next(month) : next;
    void setMonthParam(monthKey(startOfMonth(value)));
  };
  const cardFilterValue = (cardFilter || "all") as EntreNosCardFilter;

  const activeCards = useMemo(
    () => cards.filter((c) => c.is_active !== false),
    [cards]
  );

  const monthLabel = formatMonthYear(month);

  const selectedCard =
    cardFilter !== "all" && cardFilter !== "other"
      ? activeCards.find((c) => c.id === cardFilter) ?? null
      : null;

  const cycleHint = useMemo(() => {
    if (selectedCard) {
      const cycle = entreNosCardCycle(
        month,
        selectedCard.closing_day,
        selectedCard.due_day
      );
      if (cycle) {
        const due =
          selectedCard.due_day != null
            ? ` · vence dia ${selectedCard.due_day}`
            : " · sem vencimento (usa mês do fechamento)";
        return `Compras ${formatEntreNosCycleRange(cycle.from, cycle.to)} · fecha ${selectedCard.closing_day}${due}`;
      }
      return "Sem dia de fechamento — usando mês civil";
    }
    if (cardFilter === "other") {
      return `Conta e acertos · ${monthLabel}`;
    }
    return "Mês = vencimento da fatura · cada parcela entra no seu ciclo · contagem só com consumidor ≠ quem pagou/dono";
  }, [selectedCard, cardFilter, month, monthLabel]);

  const {
    data: rawTxs = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["entre-nos", member.workspace_id, monthKey(month)],
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const range = entreNosMonthQueryRange(month);
      const supabase = createClient();
      const { data, error: qError } = await supabase
        .from("transactions")
        .select(ENTRE_NOS_TX_SELECT)
        .eq("workspace_id", member.workspace_id)
        .in("transaction_type", ["expense", "loan_given", "settlement"])
        .neq("status", "cancelled")
        .gte("transaction_date", range.from)
        .lte("transaction_date", range.to)
        .order("transaction_date", { ascending: false })
        .limit(ENTRE_NOS_TX_LIMIT);
      if (qError) throw new Error(qError.message);
      return (data ?? []) as EntreNosTx[];
    },
  });

  const txs = useMemo(() => {
    const enriched = enrichEntreNosTxsWithCards(rawTxs, activeCards);
    const inMonth = filterEntreNosTxsForMonth(enriched, month);
    return filterEntreNosTxsByCard(inMonth, cardFilterValue);
  }, [rawTxs, activeCards, month, cardFilterValue]);

  const settlement = useMemo(() => {
    const raw = computeEntreNosSettlement(
      members.map((m) => ({ id: m.id, display_name: m.display_name })),
      txs,
      { month }
    );
    const debtor = raw.debtor
      ? {
          member: members.find((m) => m.id === raw.debtor!.id) ?? null,
          net: raw.debtor.net,
        }
      : null;
    const creditor = raw.creditor
      ? {
          member: members.find((m) => m.id === raw.creditor!.id) ?? null,
          net: raw.creditor.net,
        }
      : null;

    const debtTxs =
      raw.debtor && raw.creditor
        ? raw.recent.filter(
            (item) =>
              (item.consumerId === raw.debtor!.id &&
                item.payerId === raw.creditor!.id) ||
              (item.consumerId === raw.creditor!.id &&
                item.payerId === raw.debtor!.id)
          )
        : raw.recent;

    return {
      debtor,
      creditor,
      netAmount: raw.netAmount,
      aPaidForB: raw.aPaidForB,
      bPaidForA: raw.bPaidForA,
      settledAmount: raw.settledAmount,
      balances: raw.balances,
      byCard: raw.byCard,
      debtTxs,
      preview: debtTxs.filter((t) => !t.isSettlement).slice(0, 8),
      settlementTxs: debtTxs.filter((t) => t.isSettlement),
      balanced: raw.balanced,
    };
  }, [txs, members, month]);

  const subtitle =
    members.length >= 2
      ? members
          .slice(0, 2)
          .map((m) => m.display_name)
          .join(" & ")
      : member.workspace?.name ?? "Workspace";

  const hasDebt =
    settlement.debtor?.member &&
    settlement.creditor?.member &&
    settlement.netAmount >= 1;

  const hasAnyActivity =
    settlement.debtTxs.length > 0 ||
    settlement.balances.some((b) => Math.abs(b.net) >= 1);

  const cardPurchases = settlement.debtTxs.filter(
    (t) => t.cardName && !t.isSettlement
  );

  const canSettle = hasDebt && cardFilterValue === "all";

  return (
    <div className="flex flex-col pb-2 md:pb-8">
      <TopBar
        title="Entre Nós"
        subtitle={subtitle}
        className="md:px-6"
        rightEl={
          <button
            type="button"
            className="touch-target flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-chip)]"
            aria-label="Compartilhar"
          >
            <Share2 size={16} strokeWidth={2} className="text-[var(--color-silver)]" />
          </button>
        }
      />

      <div className="page-pad space-y-5 md:px-6">
        {/* Seletor de mês */}
        <div className="flex items-center justify-between rounded-xl border border-[var(--color-fog)] bg-[var(--color-white)] px-2 py-2">
          <button
            type="button"
            className="touch-target flex h-11 w-11 items-center justify-center rounded-lg text-[var(--color-graphite)] active:bg-[var(--color-pearl)]"
            aria-label="Mês anterior"
            onClick={() => setMonth((m) => startOfMonth(addMonths(m, -1)))}
          >
            <ChevronLeft size={18} strokeWidth={2} />
          </button>
          <div className="min-w-0 flex-1 px-2 text-center">
            <p className="text-[14px] font-semibold capitalize text-[var(--color-ink)]">
              {monthLabel}
            </p>
            <p className="truncate text-[11px] text-[var(--color-silver)]">{cycleHint}</p>
          </div>
          <button
            type="button"
            className="touch-target flex h-11 w-11 items-center justify-center rounded-lg text-[var(--color-graphite)] active:bg-[var(--color-pearl)]"
            aria-label="Próximo mês"
            onClick={() => setMonth((m) => startOfMonth(addMonths(m, 1)))}
          >
            <ChevronRight size={18} strokeWidth={2} />
          </button>
        </div>

        {/* Filtro por cartão */}
        <div className="scroll-fade-x -mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <FilterChip
            active={cardFilterValue === "all"}
            onClick={() => void setCardFilter("all")}
            label="Todos"
          />
          {activeCards.map((card) => (
            <FilterChip
              key={card.id}
              active={cardFilterValue === card.id}
              onClick={() => void setCardFilter(card.id)}
              label={card.name}
              icon={<CreditCard size={12} strokeWidth={2} />}
              hint={card.closing_day ? `fecha ${card.closing_day}` : undefined}
            />
          ))}
          <FilterChip
            active={cardFilterValue === "other"}
            onClick={() => void setCardFilter("other")}
            label="Conta"
            icon={<Wallet size={12} strokeWidth={2} />}
          />
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <DsSkeleton h="h-24" className="rounded-xl" />
            <DsSkeleton h="h-40" className="rounded-xl" />
            <DsSkeleton h="h-28" className="rounded-xl" />
          </div>
        ) : isError ? (
          <EmptyState
            title="Não foi possível carregar"
            description={
              error instanceof Error
                ? error.message
                : "Tente de novo em instantes."
            }
            actionLabel="Tentar de novo"
            onAction={() => void refetch()}
          />
        ) : members.length < 2 ? (
          <EmptyState
            title="Aguardando membros"
            description="Convide alguém para o workspace. Quando entrarem, o acerto aparece aqui."
          />
        ) : !hasAnyActivity ? (
          <EmptyState
            title="Tudo certo neste mês"
            description={
              settlement.settledAmount > 0
                ? `Acertos de ${monthLabel} cobriram o saldo (${formatCurrency(settlement.settledAmount)}).`
                : selectedCard
                  ? `Nenhuma divisão no ${selectedCard.name} neste ciclo.`
                  : `Não há saldo em ${monthLabel}. Com cartão, o mês é o do vencimento (não o da compra). Parcelas (2/n, 3/n…) aparecem nos meses seguintes — use as setas do mês.`
            }
          />
        ) : (
          <>
            {/* Quanto cada um deve */}
            <div className="overflow-hidden rounded-xl border border-[var(--color-fog)] bg-[var(--color-white)]">
              <p className="px-4 pb-2 pt-4 text-[11px] font-medium uppercase tracking-wider text-[var(--color-silver)]">
                Quanto cada um deve
              </p>
              <Divider />
              <div className="divide-y divide-[var(--color-fog)]">
                {settlement.balances.map((bal) => {
                  const m = members.find((x) => x.id === bal.id);
                  if (!m) return null;
                  const owes = bal.net < -0.5;
                  const receives = bal.net > 0.5;
                  return (
                    <div
                      key={bal.id}
                      className="flex items-center gap-3 px-4 py-3.5"
                    >
                      <Avatar member={toDsMember(m)} size={40} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-medium text-[var(--color-ink)]">
                          {m.display_name}
                        </p>
                        <p className="text-[12px] text-[var(--color-silver)]">
                          {owes
                            ? "Deve neste período"
                            : receives
                              ? "A receber neste período"
                              : "Quites neste período"}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 font-mono text-[15px] font-semibold ${
                          owes
                            ? "text-[var(--color-expense)]"
                            : receives
                              ? "text-[var(--color-income)]"
                              : "text-[var(--color-silver)]"
                        }`}
                      >
                        {owes
                          ? formatCurrency(Math.abs(bal.net))
                          : receives
                            ? `+${formatCurrency(bal.net)}`
                            : formatCurrency(0)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {hasDebt && (
              <div className="relative overflow-hidden rounded-xl border border-[var(--color-fog)] bg-[var(--color-white)] p-6">
                <div className="relative z-10 mb-6 flex items-center justify-between">
                  <div className="flex flex-col items-center gap-2">
                    <div className="relative">
                      <Avatar
                        member={toDsMember(settlement.debtor!.member!)}
                        size={56}
                      />
                      <div className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-[0.5px] border-[var(--color-white)] bg-[var(--color-expense)]">
                        <ArrowUpRight
                          size={10}
                          strokeWidth={3}
                          className="text-[var(--color-white)]"
                        />
                      </div>
                    </div>
                    <p className="text-[13px] font-medium text-[var(--color-ink)]">
                      {settlement.debtor!.member!.display_name}
                    </p>
                    <Badge
                      label="Deve"
                      color="var(--color-expense)"
                      bg="color-mix(in srgb, var(--color-expense) 8%, transparent)"
                    />
                  </div>

                  <div className="flex flex-1 flex-col items-center gap-2 px-4">
                    <div className="flex w-full items-center">
                      <div className="h-px flex-1 bg-[var(--color-fog)]" />
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-chip)]">
                        <ArrowRight
                          size={12}
                          strokeWidth={2.5}
                          className="text-[var(--color-silver)]"
                        />
                      </div>
                      <div className="h-px flex-1 bg-[var(--color-fog)]" />
                    </div>
                    <span className="text-[10px] font-medium text-[var(--color-graphite)]">
                      acerto líquido
                    </span>
                  </div>

                  <div className="flex flex-col items-center gap-2">
                    <div className="relative">
                      <Avatar
                        member={toDsMember(settlement.creditor!.member!)}
                        size={56}
                      />
                      <div className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-[0.5px] border-[var(--color-white)] bg-[var(--color-income)]">
                        <ArrowDownLeft
                          size={10}
                          strokeWidth={3}
                          className="text-[var(--color-white)]"
                        />
                      </div>
                    </div>
                    <p className="text-[13px] font-medium text-[var(--color-ink)]">
                      {settlement.creditor!.member!.display_name}
                    </p>
                    <Badge
                      label="Recebe"
                      color="var(--color-income)"
                      bg="color-mix(in srgb, var(--color-income) 8%, transparent)"
                    />
                  </div>
                </div>

                <div className="flex flex-col items-center gap-1.5 border-t border-[var(--color-fog)] py-5">
                  <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-silver)]">
                    {selectedCard
                      ? `Saldo · ${selectedCard.name}`
                      : `Saldo de ${monthLabel}`}
                  </p>
                  <MoneyDisplay
                    amount={settlement.netAmount}
                    size="xl"
                    color="var(--color-expense)"
                  />
                  <p className="text-center text-sm text-[var(--color-silver)]">
                    <span className="font-medium text-[var(--color-ink)]">
                      {settlement.debtor!.member!.display_name}
                    </span>{" "}
                    deve pagar para{" "}
                    <span className="font-medium text-[var(--color-ink)]">
                      {settlement.creditor!.member!.display_name}
                    </span>
                  </p>
                </div>
              </div>
            )}

            {/* Por cartão (só em Todos) */}
            {cardFilterValue === "all" && settlement.byCard.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-[var(--color-fog)] bg-[var(--color-white)]">
                <p className="px-4 pb-2 pt-4 text-[11px] font-medium uppercase tracking-wider text-[var(--color-silver)]">
                  Por cartão neste mês
                </p>
                <Divider />
                <div className="divide-y divide-[var(--color-fog)]">
                  {settlement.byCard.map((card) => (
                    <button
                      key={card.cardId}
                      type="button"
                      onClick={() => void setCardFilter(card.cardId)}
                      className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-[var(--color-pearl)]"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--color-pearl)]">
                        <CreditCard
                          size={16}
                          strokeWidth={2}
                          className="text-[var(--color-graphite)]"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-medium text-[var(--color-ink)]">
                          {card.cardName}
                        </p>
                        <p className="mt-0.5 text-[11px] text-[var(--color-silver)]">
                          {card.cycleFrom && card.cycleTo
                            ? formatEntreNosCycleRange(
                                card.cycleFrom,
                                card.cycleTo
                              )
                            : card.closingDay
                              ? `Fecha dia ${card.closingDay}`
                              : "Sem fechamento"}
                          {card.debtor && card.creditor && card.netAmount >= 1
                            ? ` · ${card.debtor.name} deve ${formatCurrency(card.netAmount)}`
                            : " · quites"}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 font-mono text-[14px] font-medium ${
                          card.netAmount >= 1
                            ? "text-[var(--color-expense)]"
                            : "text-[var(--color-silver)]"
                        }`}
                      >
                        {card.netAmount >= 1
                          ? formatCurrency(card.netAmount)
                          : formatCurrency(0)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowDebtDetail((v) => !v)}
              className="flex w-full items-center justify-between rounded-xl border border-[var(--color-fog)] bg-[var(--color-white)] px-4 py-3.5 text-left"
            >
              <div>
                <p className="text-[14px] font-medium text-[var(--color-ink)]">
                  Ver lançamentos
                </p>
                <p className="mt-0.5 text-[12px] text-[var(--color-silver)]">
                  {settlement.debtTxs.length} lançamento
                  {settlement.debtTxs.length === 1 ? "" : "s"}
                  {cardPurchases.length > 0
                    ? ` · ${cardPurchases.length} no cartão`
                    : ""}
                  {settlement.settlementTxs.length > 0
                    ? ` · ${settlement.settlementTxs.length} acerto(s)`
                    : ""}
                </p>
              </div>
              {showDebtDetail ? (
                <ChevronDown size={18} className="text-[var(--color-silver)]" />
              ) : (
                <ChevronRight size={18} className="text-[var(--color-silver)]" />
              )}
            </button>

            {showDebtDetail && settlement.debtTxs.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-[var(--color-fog)] bg-[var(--color-white)]">
                <p className="px-4 pb-2 pt-4 text-[11px] font-medium uppercase tracking-wider text-[var(--color-silver)]">
                  Lançamentos de {monthLabel}
                </p>
                <Divider />
                <div className="divide-y divide-[var(--color-fog)]">
                  {settlement.debtTxs.map((item) => {
                    const towardCreditor =
                      item.consumerId === settlement.debtor?.member?.id &&
                      item.payerId === settlement.creditor?.member?.id;
                    return (
                      <Link
                        key={item.id}
                        href={`/transactions/${item.id}`}
                        className="flex items-center gap-3 px-4 py-3.5 transition-colors active:bg-[var(--color-pearl)]"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--color-pearl)] text-base">
                          {item.isSettlement
                            ? "🤝"
                            : (item.categoryIcon ?? "💸")}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-medium text-[var(--color-ink)]">
                            {item.isSettlement
                              ? "Acerto registrado"
                              : item.title}
                          </p>
                          <div className="mt-0.5 flex flex-col gap-0.5">
                            {item.isSettlement ? (
                              <span className="text-[11px] text-[var(--color-graphite)]">
                                {item.payerName} pagou {item.consumerName}
                              </span>
                            ) : item.isSplit ? (
                              <>
                                <span className="text-[11px] font-medium text-[var(--color-ink)]">
                                  Rateio {item.sharePercent}/
                                  {item.otherSharePercent} · total{" "}
                                  {formatCurrency(item.grossAmount)}
                                </span>
                                <span className="text-[11px] text-[var(--color-graphite)]">
                                  {item.consumerName} deve{" "}
                                  {formatCurrency(item.consumerShareAmount)} ·{" "}
                                  {item.payerName} fica com{" "}
                                  {formatCurrency(item.otherShareAmount)}
                                </span>
                              </>
                            ) : (
                              <span className="text-[11px] text-[var(--color-graphite)]">
                                {item.consumerName} consumiu · {item.payerName}{" "}
                                pagou
                              </span>
                            )}
                            <div className="flex flex-wrap items-center gap-x-1.5">
                              {item.cardName ? (
                                <span className="inline-flex items-center gap-1 text-[11px] text-[var(--color-silver)]">
                                  <CreditCard size={10} strokeWidth={2} />
                                  {item.cardName}
                                </span>
                              ) : null}
                              <span className="text-[11px] text-[var(--color-mist)]">
                                {item.cardName ? "· " : ""}
                                {formatDate(item.date)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-0.5">
                          <span
                            className={`font-mono text-[14px] font-medium ${
                              item.isSettlement || !towardCreditor
                                ? "text-[var(--color-income)]"
                                : "text-[var(--color-expense)]"
                            }`}
                          >
                            {item.isSettlement || !towardCreditor ? "−" : "+"}
                            {formatCurrency(item.amount)}
                          </span>
                          {item.isSplit ? (
                            <span className="text-[10px] text-[var(--color-silver)]">
                              dívida
                            </span>
                          ) : (
                            <ChevronRight size={14} className="text-[var(--color-mist)]" />
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {hasDebt && (
              <div className="overflow-hidden rounded-xl border border-[var(--color-fog)] bg-[var(--color-white)]">
                <p className="px-4 pb-3 pt-4 text-[11px] font-medium uppercase tracking-wider text-[var(--color-silver)]">
                  Resumo do período
                </p>
                <Divider />
                <div className="flex items-center justify-between px-4 py-3.5">
                  <p className="text-[13px] text-[var(--color-silver)]">
                    {settlement.creditor!.member!.display_name} pagou por{" "}
                    {settlement.debtor!.member!.display_name}
                  </p>
                  <span className="font-mono text-[14px] font-medium text-[var(--color-expense)]">
                    {formatCurrency(settlement.bPaidForA)}
                  </span>
                </div>
                <Divider />
                <div className="flex items-center justify-between px-4 py-3.5">
                  <p className="text-[13px] text-[var(--color-silver)]">
                    {settlement.debtor!.member!.display_name} pagou por{" "}
                    {settlement.creditor!.member!.display_name}
                  </p>
                  <span className="font-mono text-[14px] font-medium text-[var(--color-income)]">
                    {formatCurrency(settlement.aPaidForB)}
                  </span>
                </div>
                {settlement.settledAmount > 0 ? (
                  <>
                    <Divider />
                    <div className="flex items-center justify-between px-4 py-3.5">
                      <p className="text-[13px] text-[var(--color-silver)]">Já acertado</p>
                      <span className="font-mono text-[14px] font-medium text-[var(--color-income)]">
                        −{formatCurrency(settlement.settledAmount)}
                      </span>
                    </div>
                  </>
                ) : null}
                <div className="flex items-center justify-between border-t border-[var(--color-fog)] px-4 py-3.5">
                  <p className="text-[13px] font-medium text-[var(--color-ink)]">
                    Diferença
                  </p>
                  <span className="font-mono text-[15px] font-medium text-[var(--color-expense)]">
                    {formatCurrency(settlement.netAmount)}
                  </span>
                </div>
              </div>
            )}

            {canSettle && (
              <div className="flex flex-col gap-2 pt-1">
                <Btn
                  variant="primary"
                  size="lg"
                  fullWidth
                  wsColor="var(--color-ink)"
                  icon={<Check size={18} strokeWidth={2.5} />}
                  onClick={() => setSettleOpen(true)}
                >
                  Registrar acerto do mês
                </Btn>
                <Btn
                  variant="secondary"
                  size="md"
                  fullWidth
                  icon={<QrCode size={16} />}
                  onClick={() => {
                    const text = `PIX: ${formatCurrency(settlement.netAmount)} de ${settlement.debtor!.member!.display_name} para ${settlement.creditor!.member!.display_name} (${monthLabel})`;
                    void navigator.clipboard?.writeText(text);
                  }}
                >
                  Copiar texto PIX
                </Btn>
              </div>
            )}

            {cardFilterValue !== "all" && hasDebt && (
              <p className="text-center text-[12px] text-[var(--color-silver)]">
                Para registrar acerto, volte ao filtro{" "}
                <button
                  type="button"
                  className="font-medium text-[var(--color-ink)] underline"
                  onClick={() => void setCardFilter("all")}
                >
                  Todos
                </button>
                .
              </p>
            )}

            {canSettle && settlement.debtor?.member && settlement.creditor?.member && (
              <SettleEntreNosDialog
                open={settleOpen}
                onOpenChange={setSettleOpen}
                member={member}
                debtor={settlement.debtor.member}
                creditor={settlement.creditor.member}
                netAmount={settlement.netAmount}
                alreadySettled={settlement.settledAmount}
                defaultPaymentDate={defaultSettleDate(month)}
                monthLabel={monthLabel}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  icon,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: ReactNode;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`touch-target inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2.5 text-[13px] font-medium transition-colors ${
        active
          ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-white)]"
          : "border-[var(--color-fog)] bg-[var(--color-white)] text-[var(--color-graphite)] active:bg-[var(--color-pearl)]"
      }`}
    >
      {icon}
      <span>{label}</span>
      {hint ? (
        <span
          className={
            active
              ? "text-[var(--color-white)]/70"
              : "text-[var(--color-silver)]"
          }
        >          · {hint}
        </span>
      ) : null}
    </button>
  );
}
