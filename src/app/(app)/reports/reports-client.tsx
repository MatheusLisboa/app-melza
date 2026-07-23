"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  useAccounts,
  useCards,
  useWorkspaceMembers,
} from "@/lib/hooks/use-finance";
import type { WorkspaceMember, TransactionWithRelations } from "@/types";
import {
  addMonths,
  endOfMonth,
  formatCurrency,
  formatDate,
  formatMonthYear,
  startOfMonth,
  toISODate,
} from "@/lib/utils/format";
import { downloadCsv, toCsv } from "@/lib/utils/csv";
import { Btn, DsSkeleton, EmptyState } from "@/components/design-system";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, TrendingDown, TrendingUp } from "lucide-react";
import { CsvImportCard } from "@/components/transactions/csv-import";
import { cn } from "@/lib/utils";

export function ReportsClient({ member }: { member: WorkspaceMember }) {
  const now = useMemo(() => new Date(), []);
  const [from, setFrom] = useState(toISODate(startOfMonth(now)));
  const [to, setTo] = useState(toISODate(endOfMonth(now)));
  const [cardId, setCardId] = useState("all");
  const [memberId, setMemberId] = useState("all");
  const [categoryId, setCategoryId] = useState("all");
  const [txType, setTxType] = useState("all");

  const { data: cards = [] } = useCards(member.workspace_id);
  const activeCards = useMemo(
    () => cards.filter((c) => c.is_active),
    [cards]
  );
  const inactiveCardIds = useMemo(
    () => new Set(cards.filter((c) => !c.is_active).map((c) => c.id)),
    [cards]
  );
  const { data: accounts = [] } = useAccounts(member.workspace_id);
  const { data: members = [] } = useWorkspaceMembers(member.workspace_id);

  const { data: categories = [] } = useQuery({
    queryKey: ["categories", member.workspace_id],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, icon, color, type")
        .eq("workspace_id", member.workspace_id);
      if (error) throw error;
      return (data ?? []) as {
        id: string;
        name: string;
        icon: string | null;
        color: string;
        type: string;
      }[];
    },
  });

  const { data: rawTransactions = [], isLoading, isError, error } = useQuery({
    queryKey: [
      "reports",
      member.workspace_id,
      from,
      to,
      cardId,
      memberId,
      categoryId,
      txType,
    ],
    queryFn: async () => {
      const supabase = createClient();
      let q = supabase
        .from("transactions")
        .select(
          `
          id, amount, description, transaction_type, status, transaction_date,
          category_id, card_id, account_id, paid_by_member_id, consumer_member_id,
          tags,
          category:categories(id, name, icon, color),
          card:cards(id, name)
        `
        )
        .eq("workspace_id", member.workspace_id)
        .gte("transaction_date", from)
        .lte("transaction_date", to)
        .neq("status", "cancelled")
        .order("transaction_date", { ascending: false })
        .limit(800);

      if (cardId !== "all") q = q.eq("card_id", cardId);
      if (memberId !== "all") q = q.eq("paid_by_member_id", memberId);
      if (categoryId !== "all") q = q.eq("category_id", categoryId);
      if (txType !== "all") q = q.eq("transaction_type", txType);

      const { data, error: qError } = await q;
      if (qError) throw new Error(qError.message);
      return data as TransactionWithRelations[];
    },
  });

  const transactions = useMemo(() => {
    if (cardId !== "all" || inactiveCardIds.size === 0) return rawTransactions;
    return rawTransactions.filter(
      (t) => !t.card_id || !inactiveCardIds.has(t.card_id)
    );
  }, [rawTransactions, cardId, inactiveCardIds]);

  const prevMonth = addMonths(now, -1);
  const prevFrom = toISODate(startOfMonth(prevMonth));
  const prevTo = toISODate(endOfMonth(prevMonth));
  const curFrom = toISODate(startOfMonth(now));
  const curTo = toISODate(endOfMonth(now));

  const { data: compareRaw = [] } = useQuery({
    queryKey: ["reports-compare", member.workspace_id, prevFrom, curTo],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error: qError } = await supabase
        .from("transactions")
        .select("amount, transaction_type, transaction_date, status, category_id, card_id")
        .eq("workspace_id", member.workspace_id)
        .gte("transaction_date", prevFrom)
        .lte("transaction_date", curTo)
        .neq("status", "cancelled")
        .limit(800);
      if (qError) throw new Error(qError.message);
      return data as {
        amount: number;
        transaction_type: string;
        transaction_date: string;
        status: string;
        category_id: string | null;
        card_id: string | null;
      }[];
    },
  });

  const compareTx = useMemo(() => {
    if (inactiveCardIds.size === 0) return compareRaw;
    return compareRaw.filter(
      (t) => !t.card_id || !inactiveCardIds.has(t.card_id)
    );
  }, [compareRaw, inactiveCardIds]);

  const expenseTotal = useMemo(
    () =>
      transactions
        .filter(
          (t) =>
            (t.transaction_type === "expense" ||
              t.transaction_type === "loan_given") &&
            t.status !== "scheduled"
        )
        .reduce((s, t) => s + Number(t.amount), 0),
    [transactions]
  );

  const incomeTotal = useMemo(
    () =>
      transactions
        .filter(
          (t) =>
            (t.transaction_type === "income" ||
              t.transaction_type === "loan_received") &&
            t.status !== "scheduled"
        )
        .reduce((s, t) => s + Number(t.amount), 0),
    [transactions]
  );

  const compare = useMemo(() => {
    const sumExpense = (fromDate: string, toDate: string) =>
      compareTx
        .filter(
          (t) =>
            t.transaction_date >= fromDate &&
            t.transaction_date <= toDate &&
            t.status !== "scheduled" &&
            (t.transaction_type === "expense" ||
              t.transaction_type === "loan_given")
        )
        .reduce((s, t) => s + Number(t.amount), 0);

    const current = sumExpense(curFrom, curTo);
    const previous = sumExpense(prevFrom, prevTo);
    const delta = current - previous;
    const pct = previous > 0 ? (delta / previous) * 100 : current > 0 ? 100 : 0;

    return { current, previous, delta, pct };
  }, [compareTx, curFrom, curTo, prevFrom, prevTo]);

  function exportCsv() {
    const csv = toCsv(
      [
        "Data",
        "Descrição",
        "Tipo",
        "Valor",
        "Categoria",
        "Cartão",
        "Conta",
        "Pago por",
        "Status",
      ],
      transactions.map((t) => [
        t.transaction_date,
        t.description,
        t.transaction_type,
        Number(t.amount).toFixed(2).replace(".", ","),
        t.category?.name ?? "",
        t.card?.name ?? "",
        t.account?.name ?? "",
        members.find((m) => m.id === t.paid_by_member_id)?.display_name ?? "",
        t.status,
      ])
    );
    downloadCsv(`melza-${from}_${to}.csv`, csv);
  }

  return (
    <div className="page-pad space-y-5 md:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[17px] font-semibold tracking-tight text-[var(--color-ink)]">
            Relatórios
          </h1>
          <p className="mt-0.5 text-sm text-[var(--color-silver)]">
            Extrato, comparativo e exportação
          </p>
        </div>
        <Btn
          variant="secondary"
          size="sm"
          onClick={exportCsv}
          disabled={transactions.length === 0}
          icon={<Download className="h-3.5 w-3.5" />}
        >
          CSV
        </Btn>
      </div>

      {/* Comparativo — hero ink + 2 cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-[14px] bg-[var(--color-hero)] px-5 py-4 sm:col-span-1">
          <p className="text-[11px] font-medium uppercase tracking-wider text-[#8E8E93]">
            Este mês · {formatMonthYear(now)}
          </p>
          <p className="mt-2 font-mono text-2xl font-extrabold text-white">
            {formatCurrency(compare.current)}
          </p>
          <p className="mt-1 text-xs text-[#636366]">Despesas</p>
        </div>
        <div className="rounded-[14px] border border-[var(--color-line)] bg-[var(--color-card)] px-5 py-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-2)]">
            Mês passado
          </p>
          <p className="mt-2 font-mono text-2xl font-extrabold text-[var(--color-text)]">
            {formatCurrency(compare.previous)}
          </p>
        </div>
        <div className="rounded-[14px] border border-[var(--color-line)] bg-[var(--color-card)] px-5 py-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-2)]">
            Variação
          </p>
          <p
            className={cn(
              "mt-2 flex items-center gap-1.5 font-mono text-2xl font-extrabold",
              compare.delta > 0
                ? "text-[#EF4444]"
                : compare.delta < 0
                  ? "text-[#22C55E]"
                  : "text-[var(--color-text)]"
            )}
          >
            {compare.delta > 0 ? (
              <TrendingUp className="h-4 w-4" />
            ) : compare.delta < 0 ? (
              <TrendingDown className="h-4 w-4" />
            ) : null}
            {compare.delta >= 0 ? "+" : ""}
            {formatCurrency(compare.delta)}
          </p>
          <p className="mt-1 text-xs text-[var(--color-text-2)]">
            {compare.pct >= 0 ? "+" : ""}
            {compare.pct.toFixed(1)}% vs mês anterior
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="grid gap-3 rounded-[14px] border border-[var(--color-line)] bg-[var(--color-card)] p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div className="space-y-1.5">
          <Label className="text-[var(--color-text-2)]">De</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[var(--color-text-2)]">Até</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[var(--color-text-2)]">Cartão</Label>
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
        <div className="space-y-1.5">
          <Label className="text-[var(--color-text-2)]">Categoria</Label>
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
        <div className="space-y-1.5">
          <Label className="text-[var(--color-text-2)]">Pago por</Label>
          <Select value={memberId} onValueChange={setMemberId}>
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
        <div className="space-y-1.5">
          <Label className="text-[var(--color-text-2)]">Tipo</Label>
          <Select value={txType} onValueChange={setTxType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="expense">Despesa</SelectItem>
              <SelectItem value="income">Receita</SelectItem>
              <SelectItem value="transfer">Transferência</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <span className="text-[var(--color-text-2)]">
          Despesas:{" "}
          <strong className="font-mono font-bold text-[#EF4444]">
            {formatCurrency(expenseTotal)}
          </strong>
        </span>
        <span className="text-[var(--color-text-2)]">
          Receitas:{" "}
          <strong className="font-mono font-bold text-[#22C55E]">
            {formatCurrency(incomeTotal)}
          </strong>
        </span>
        <span className="text-[var(--color-text-2)]">
          {transactions.length} lançamento(s)
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <DsSkeleton h="h-14" className="rounded-xl" />
          <DsSkeleton h="h-14" className="rounded-xl" />
          <DsSkeleton h="h-14" className="rounded-xl" />
          <DsSkeleton h="h-14" className="rounded-xl" />
        </div>
      ) : isError ? (
        <p className="text-sm text-[#EF4444]">
          {error instanceof Error ? error.message : "Erro ao carregar"}
        </p>
      ) : transactions.length === 0 ? (
        <EmptyState
          title="Nenhum lançamento"
          description="Não há lançamentos no período filtrado. Ajuste as datas ou cadastre movimentos."
          actionLabel="Ir ao histórico"
          onAction={() => {
            window.location.assign("/transactions");
          }}
        />
      ) : (
        <div className="overflow-hidden rounded-[14px] border border-[var(--color-line)] bg-[var(--color-card)]">
          {transactions.map((tx, i) => {
            const isExpense =
              tx.transaction_type === "expense" ||
              tx.transaction_type === "loan_given";
            const isIncome =
              tx.transaction_type === "income" ||
              tx.transaction_type === "loan_received";
            const payerName = members.find(
              (m) => m.id === tx.paid_by_member_id
            )?.display_name;
            const initial = (
              tx.description.trim().charAt(0) || "?"
            ).toUpperCase();

            return (
              <div
                key={tx.id}
                className={cn(
                  "flex items-center gap-3 px-4 py-3",
                  i > 0 && "border-t border-[var(--color-line-soft)]"
                )}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-icon)] text-[13px] font-bold text-white">
                  {initial}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--color-text)]">
                    {tx.description}
                  </p>
                  <p className="text-xs text-[var(--color-text-2)]">
                    {[
                      formatDate(tx.transaction_date),
                      tx.category?.name,
                      payerName,
                      tx.card?.name,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <p
                  className={cn(
                    "shrink-0 font-mono text-sm font-bold",
                    isExpense
                      ? "text-[#EF4444]"
                      : isIncome
                        ? "text-[#22C55E]"
                        : "text-[var(--color-text)]"
                  )}
                >
                  {isExpense ? "−" : isIncome ? "+" : ""}
                  {formatCurrency(Number(tx.amount))}
                </p>
              </div>
            );
          })}
        </div>
      )}

      <CsvImportCard member={member} cards={activeCards} accounts={accounts} />
    </div>
  );
}
