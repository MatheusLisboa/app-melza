"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { Search, SlidersHorizontal } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useCards, useWorkspaceMembers } from "@/lib/hooks/use-finance";
import type { Category, WorkspaceMember, TransactionWithRelations } from "@/types";
import {
  Fab,
  TopBar,
  TxRow,
  InputField,
  DsSkeleton,
  EmptyState,
  toDsMember,
} from "@/components/design-system";
import {
  formatCurrency,
  formatDate,
  toISODate,
  addMonths,
  startOfMonth,
  endOfMonth,
} from "@/lib/utils/format";
import { workspaceAccent } from "@/lib/utils/workspace";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { collapseInstallmentPurchases } from "@/lib/finance/collapse-installments";
import { cn } from "@/lib/utils";
import { paymentMethodCaption } from "@/lib/utils/payment-channel";

const TransactionFormDialog = dynamic(
  () =>
    import("@/components/transactions/transaction-form").then((m) => ({
      default: m.TransactionFormDialog,
    })),
  { ssr: false }
);
const TransactionDetailSheet = dynamic(
  () =>
    import("@/components/transactions/transaction-detail-sheet").then((m) => ({
      default: m.TransactionDetailSheet,
    })),
  { ssr: false }
);

type FilterTab = "all" | "income" | "expense";

export function TransactionsPageClient({ member }: { member: WorkspaceMember }) {
  const now = useMemo(() => new Date(), []);
  const defaults = useMemo(() => {
    const from = toISODate(new Date(now.getFullYear(), now.getMonth() - 6, 1));
    const to = toISODate(new Date(now.getFullYear(), now.getMonth() + 13, 0));
    return { from, to };
  }, [now]);
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [cardId, setCardId] = useState<string>("all");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [paidBy, setPaidBy] = useState<string>("all");
  const [filter, setFilter] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const filtersActive =
    cardId !== "all" ||
    categoryId !== "all" ||
    paidBy !== "all" ||
    from !== defaults.from ||
    to !== defaults.to;

  const { data: cards = [] } = useCards(member.workspace_id);
  const activeCards = useMemo(
    () => cards.filter((c) => c.is_active),
    [cards]
  );
  const { data: members = [] } = useWorkspaceMembers(member.workspace_id);

  const { data: categories = [] } = useQuery({
    queryKey: ["categories", member.workspace_id],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("workspace_id", member.workspace_id);
      if (error) throw error;
      return data as Category[];
    },
  });

  const txType = filter === "all" ? "all" : filter;

  const {
    data: transactions = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: [
      "transactions",
      member.workspace_id,
      from,
      to,
      cardId,
      categoryId,
      paidBy,
      txType,
    ],
    queryFn: async () => {
      const supabase = createClient();
      // Sem embed de accounts — há 2 FKs (account_id / transfer_to_account_id)
      let query = supabase
        .from("transactions")
        .select(
          `
          *,
          category:categories(id, name, icon, color),
          card:cards(id, name, owner_member_id, bank)
        `
        )
        .eq("workspace_id", member.workspace_id)
        .gte("transaction_date", from)
        .lte("transaction_date", to)
        .neq("status", "cancelled")
        .order("transaction_date", { ascending: false })
        .limit(500);

      if (cardId !== "all") query = query.eq("card_id", cardId);
      if (categoryId !== "all") query = query.eq("category_id", categoryId);
      if (paidBy !== "all") query = query.eq("paid_by_member_id", paidBy);
      if (txType !== "all") query = query.eq("transaction_type", txType);

      const { data, error: qError } = await query;
      if (qError) throw new Error(qError.message);
      return data as TransactionWithRelations[];
    },
  });

  const filtered = useMemo(() => {
    const base = !search.trim()
      ? transactions
      : transactions.filter((t) => {
          const q = search.toLowerCase();
          return (
            t.description.toLowerCase().includes(q) ||
            t.category?.name?.toLowerCase().includes(q)
          );
        });
    return collapseInstallmentPurchases(base);
  }, [transactions, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, (typeof filtered)[number][]>();
    for (const tx of filtered) {
      const key = formatDate(tx.transaction_date);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(tx);
    }
    return Array.from(map.entries()).map(([dateLabel, txs]) => {
      const net = txs.reduce((sum, tx) => {
        if (tx.status === "scheduled") return sum;
        if (
          tx.transaction_type === "expense" ||
          tx.transaction_type === "loan_given"
        ) {
          return sum - tx.displayAmount;
        }
        if (
          tx.transaction_type === "income" ||
          tx.transaction_type === "loan_received"
        ) {
          return sum + tx.displayAmount;
        }
        return sum;
      }, 0);
      return { dateLabel, txs, net };
    });
  }, [filtered]);

  const totalExpense = useMemo(
    () =>
      filtered
        .filter(
          (t) =>
            (t.transaction_type === "expense" ||
              t.transaction_type === "loan_given") &&
            t.status !== "scheduled"
        )
        .reduce((sum, t) => sum + t.displayAmount, 0),
    [filtered]
  );

  const tabs: { id: FilterTab; label: string }[] = [
    { id: "all", label: "Tudo" },
    { id: "income", label: "Receitas" },
    { id: "expense", label: "Despesas" },
  ];
  const accent = workspaceAccent(member.workspace?.type);

  return (
    <div className="relative flex flex-col pb-2 md:pb-8">
      <TopBar
        title="Histórico"
        subtitle={`Despesas: ${formatCurrency(totalExpense)}`}
        className="md:px-6"
        rightEl={
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className={cn(
              "relative flex h-9 w-9 items-center justify-center rounded-xl",
              showFilters || filtersActive
                ? "bg-[var(--color-ink)] text-white dark:bg-[var(--color-pearl)] dark:text-[var(--color-ink)]"
                : "bg-[var(--color-chip)]"
            )}
            aria-label="Filtros"
            aria-pressed={showFilters}
          >
            <SlidersHorizontal
              size={16}
              strokeWidth={2}
              className={
                showFilters || filtersActive
                  ? undefined
                  : "text-[var(--color-text-2)]"
              }
            />
            {filtersActive && !showFilters ? (
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[var(--color-expense)]" />
            ) : null}
          </button>
        }
      />

      <div className="page-enter page-pad space-y-4 md:px-6">
        <InputField
          placeholder="Buscar transações…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          icon={<Search size={15} />}
        />

        <div className="flex gap-2">
          {tabs.map((tab) => {
            const active = filter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors",
                  active
                    ? "bg-[var(--color-ink)] text-white dark:bg-[var(--color-pearl)] dark:text-[var(--color-ink)]"
                    : "bg-[var(--color-chip)] text-[var(--color-text-2)] hover:text-[var(--color-text)]"
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {showFilters && (
          <div className="space-y-3 rounded-2xl border border-[var(--color-fog)] bg-card/40 p-4">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  {
                    id: "month",
                    label: "Este mês",
                    from: toISODate(startOfMonth(now)),
                    to: toISODate(endOfMonth(now)),
                  },
                  {
                    id: "prev",
                    label: "Mês passado",
                    from: toISODate(startOfMonth(addMonths(now, -1))),
                    to: toISODate(endOfMonth(addMonths(now, -1))),
                  },
                  {
                    id: "3m",
                    label: "3 meses",
                    from: toISODate(startOfMonth(addMonths(now, -2))),
                    to: toISODate(endOfMonth(now)),
                  },
                  {
                    id: "all",
                    label: "Período amplo",
                    from: defaults.from,
                    to: defaults.to,
                  },
                ] as const
              ).map((preset) => {
                const active = from === preset.from && to === preset.to;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setFrom(preset.from);
                      setTo(preset.to);
                    }}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors",
                      active
                        ? "bg-[var(--color-ink)] text-white dark:bg-[var(--color-pearl)] dark:text-[var(--color-ink)]"
                        : "bg-[var(--color-chip)] text-[var(--color-text-2)] hover:text-[var(--color-text)]"
                    )}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <Label>De</Label>
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Até</Label>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Cartão</Label>
              <Select value={cardId} onValueChange={setCardId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {activeCards.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Categoria</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.icon} {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Pago por</Label>
              <Select value={paidBy} onValueChange={setPaidBy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {filtersActive ? (
              <button
                type="button"
                onClick={() => {
                  setFrom(defaults.from);
                  setTo(defaults.to);
                  setCardId("all");
                  setCategoryId("all");
                  setPaidBy("all");
                }}
                className="text-left text-[13px] font-medium text-[var(--color-text-2)] underline-offset-2 hover:text-[var(--color-text)] hover:underline sm:col-span-2 lg:col-span-3"
              >
                Limpar filtros
              </button>
            ) : null}
          </div>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            <DsSkeleton h="h-14" className="rounded-xl" />
            <DsSkeleton h="h-14" className="rounded-xl" />
            <DsSkeleton h="h-14" className="rounded-xl" />
            <DsSkeleton h="h-14" className="rounded-xl" />
          </div>
        ) : isError ? (
          <div className="rounded-[14px] border border-[var(--color-line)] bg-[var(--color-card)] p-4">
            <p className="text-sm text-[var(--color-expense)]">
              Não foi possível carregar o histórico.
            </p>
            <p className="mt-1 text-xs text-[var(--color-text-2)]">
              {error instanceof Error ? error.message : "Erro desconhecido"}
            </p>
            <button
              type="button"
              className="mt-3 text-sm text-[var(--color-text)] underline"
              onClick={() => void refetch()}
            >
              Tentar de novo
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Nenhum lançamento neste período"
            description={`Período: ${formatDate(from)} a ${formatDate(to)}. Ajuste os filtros ou registre um novo lançamento.`}
            actionLabel="Novo lançamento"
            onAction={() => setCreateOpen(true)}
          />
        ) : (
          <div className="space-y-6">
            {grouped.map(({ dateLabel, txs, net }) => (
              <section key={dateLabel}>
                <h3 className="mb-2 flex items-baseline justify-between gap-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-2)]">
                  <span>{dateLabel}</span>
                  <span
                    className={cn(
                      "font-mono text-[11px] font-bold normal-case tracking-normal",
                      net > 0
                        ? "text-[var(--color-income)]"
                        : net < 0
                          ? "text-[var(--color-expense)]"
                          : "text-[var(--color-text-3)]"
                    )}
                  >
                    {net > 0 ? "+" : net < 0 ? "−" : ""}
                    {formatCurrency(Math.abs(net))}
                  </span>
                </h3>
                <div className="overflow-hidden rounded-[14px] border border-[var(--color-line)] bg-[var(--color-card)]">
                  {txs.map((tx, i) => {
                    const payerMember = members.find(
                      (m) => m.id === tx.paid_by_member_id
                    );
                    const consumerMember = members.find(
                      (m) => m.id === tx.consumer_member_id
                    );
                    const payer = payerMember
                      ? toDsMember(payerMember)
                      : null;
                    const consumer = consumerMember
                      ? toDsMember(consumerMember)
                      : payer;
                    const cardOwnerMember = members.find(
                      (m) => m.id === tx.card?.owner_member_id
                    );
                    const cardOwner = cardOwnerMember
                      ? toDsMember(cardOwnerMember)
                      : payer;
                    const isExpense =
                      tx.transaction_type === "expense" ||
                      tx.transaction_type === "loan_given";
                    const isIncome =
                      tx.transaction_type === "income" ||
                      tx.transaction_type === "loan_received";
                    const isSettlement =
                      tx.transaction_type === "settlement";

                    return (
                      <div
                        key={tx.id}
                        className={cn(
                          i > 0 && "border-t border-[var(--color-line-soft)]"
                        )}
                      >
                        <TxRow
                          embedded
                          emoji={
                            isSettlement ? "🤝" : tx.category?.icon
                          }
                          title={tx.displayDescription}
                          category={
                            isSettlement
                              ? "Acerto Entre Nós"
                              : tx.category?.name
                          }
                          paymentLabel={
                            isSettlement ? null : paymentMethodCaption(tx)
                          }
                          dateLabel={formatDate(tx.transaction_date)}
                          amount={tx.displayAmount}
                          type={
                            isIncome
                              ? "income"
                              : isExpense
                                ? "expense"
                                : "other"
                          }
                          pending={tx.status === "scheduled"}
                          installments={
                            tx.purchaseInstallments
                              ? {
                                  current: tx.purchaseInstallments,
                                  total: tx.purchaseInstallments,
                                  asPurchase: true,
                                }
                              : null
                          }
                          consumer={consumer}
                          payer={payer}
                          cardOwner={cardOwner}
                          onClick={() => setDetailId(tx.id)}
                        />
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <TransactionFormDialog
        member={member}
        open={createOpen}
        onOpenChange={setCreateOpen}
        trigger={<Fab color={accent.color} />}
      />

      <TransactionDetailSheet
        open={Boolean(detailId)}
        onOpenChange={(o) => {
          if (!o) setDetailId(null);
        }}
        member={member}
        transactionId={detailId}
      />
    </div>
  );
}
