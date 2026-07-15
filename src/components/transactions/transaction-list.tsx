"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, SlidersHorizontal } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useCards, useWorkspaceMembers } from "@/lib/hooks/use-finance";
import type { Category, WorkspaceMember, TransactionWithRelations } from "@/types";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Fab,
  TopBar,
  TxRow,
  InputField,
  toDsMember,
} from "@/components/design-system";
import {
  formatCurrency,
  formatDate,
  toISODate,
} from "@/lib/utils/format";
import { TransactionFormDialog } from "@/components/transactions/transaction-form";
import { TransactionDetailSheet } from "@/components/transactions/transaction-detail-sheet";
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
import { cn } from "@/lib/utils";

type FilterTab = "all" | "income" | "expense";

export function TransactionsPageClient({ member }: { member: WorkspaceMember }) {
  const now = new Date();
  // Histórico amplo: 6 meses atrás → 12 meses à frente (parcelas da fatura)
  const [from, setFrom] = useState(() => {
    const d = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    return toISODate(d);
  });
  const [to, setTo] = useState(() => {
    const d = new Date(now.getFullYear(), now.getMonth() + 13, 0);
    return toISODate(d);
  });
  const [cardId, setCardId] = useState<string>("all");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [paidBy, setPaidBy] = useState<string>("all");
  const [filter, setFilter] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

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
    if (!search.trim()) return transactions;
    const q = search.toLowerCase();
    return transactions.filter(
      (t) =>
        t.description.toLowerCase().includes(q) ||
        t.category?.name?.toLowerCase().includes(q)
    );
  }, [transactions, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, TransactionWithRelations[]>();
    for (const tx of filtered) {
      const key = formatDate(tx.transaction_date);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(tx);
    }
    return Array.from(map.entries());
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
        .reduce((sum, t) => sum + Number(t.amount), 0),
    [filtered]
  );

  const tabs: { id: FilterTab; label: string }[] = [
    { id: "all", label: "Tudo" },
    { id: "income", label: "Receitas" },
    { id: "expense", label: "Despesas" },
  ];
  const accent = workspaceAccent(member.workspace?.type);

  return (
    <div className="relative flex flex-col pb-28 md:pb-8">
      <TopBar
        title="Histórico"
        subtitle={`Despesas: ${formatCurrency(totalExpense)}`}
        className="md:px-6"
        rightEl={
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-chip)]"
            aria-label="Filtros"
          >
            <SlidersHorizontal
              size={16}
              strokeWidth={2}
              className="text-[#8E8E93]"
            />
          </button>
        }
      />

      <div className="page-pad space-y-4 md:px-6">
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
                  "rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-all",
                  !active && "bg-[var(--color-chip)] text-[#8E8E93]"
                )}
                style={
                  active
                    ? {
                        background: `${accent.color}25`,
                        color: accent.color,
                        border: `1px solid ${accent.color}45`,
                      }
                    : { border: "1px solid transparent" }
                }
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {showFilters && (
          <div className="grid gap-3 rounded-2xl border border-[#E5E5EA] bg-card/40 p-4 sm:grid-cols-2 lg:grid-cols-3">
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
          </div>
        )}

        {isLoading ? (
          <p className="text-sm text-[var(--color-text-2)]">Carregando…</p>
        ) : isError ? (
          <div className="rounded-[14px] border border-[var(--color-line)] bg-[var(--color-card)] p-4">
            <p className="text-sm text-[#EF4444]">
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
            description={`Período: ${formatDate(from)} a ${formatDate(to)}. Ajuste os filtros (ícone no topo) ou amplie as datas.`}
            actionLabel="Ver filtros"
            onAction={() => setShowFilters(true)}
          />
        ) : (
          <div className="space-y-6">
            {grouped.map(([dateLabel, txs]) => (
              <section key={dateLabel}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-2)]">
                  {dateLabel}
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

                    return (
                      <div
                        key={tx.id}
                        className={cn(
                          i > 0 && "border-t border-[var(--color-line-soft)]"
                        )}
                      >
                        <TxRow
                          embedded
                          emoji={tx.category?.icon}
                          title={tx.description}
                          category={tx.category?.name}
                          dateLabel={formatDate(tx.transaction_date)}
                          amount={Number(tx.amount)}
                          type={
                            isIncome
                              ? "income"
                              : isExpense
                                ? "expense"
                                : "other"
                          }
                          pending={tx.status === "scheduled"}
                          installments={
                            tx.is_installment &&
                            tx.installment_number != null &&
                            tx.total_installments != null
                              ? {
                                  current: tx.installment_number,
                                  total: tx.total_installments,
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
