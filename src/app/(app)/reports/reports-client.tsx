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
import { CategoryBadge } from "@/components/transactions/category-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, TrendingDown, TrendingUp } from "lucide-react";
import { CsvImportCard } from "@/components/transactions/csv-import";

export function ReportsClient({ member }: { member: WorkspaceMember }) {
  const now = useMemo(() => new Date(), []);
  const [from, setFrom] = useState(toISODate(startOfMonth(now)));
  const [to, setTo] = useState(toISODate(endOfMonth(now)));
  const [cardId, setCardId] = useState("all");
  const [memberId, setMemberId] = useState("all");
  const [categoryId, setCategoryId] = useState("all");
  const [txType, setTxType] = useState("all");

  const { data: cards = [] } = useCards(member.workspace_id);
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

  const { data: transactions = [], isLoading } = useQuery({
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
          *,
          category:categories(*),
          card:cards(*),
          account:accounts(*),
          paid_by:workspace_members!paid_by_member_id(*)
        `
        )
        .eq("workspace_id", member.workspace_id)
        .gte("transaction_date", from)
        .lte("transaction_date", to)
        .neq("status", "cancelled")
        .order("transaction_date", { ascending: false });

      if (cardId !== "all") q = q.eq("card_id", cardId);
      if (memberId !== "all") q = q.eq("paid_by_member_id", memberId);
      if (categoryId !== "all") q = q.eq("category_id", categoryId);
      if (txType !== "all") q = q.eq("transaction_type", txType);

      const { data, error } = await q;
      if (error) throw error;
      return data as TransactionWithRelations[];
    },
  });

  const prevMonth = addMonths(now, -1);
  const prevFrom = toISODate(startOfMonth(prevMonth));
  const prevTo = toISODate(endOfMonth(prevMonth));
  const curFrom = toISODate(startOfMonth(now));
  const curTo = toISODate(endOfMonth(now));

  const { data: compareTx = [] } = useQuery({
    queryKey: ["reports-compare", member.workspace_id, prevFrom, curTo],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("transactions")
        .select("amount, transaction_type, transaction_date, status, category_id")
        .eq("workspace_id", member.workspace_id)
        .gte("transaction_date", prevFrom)
        .lte("transaction_date", curTo)
        .neq("status", "cancelled");
      if (error) throw error;
      return data as {
        amount: number;
        transaction_type: string;
        transaction_date: string;
        status: string;
        category_id: string | null;
      }[];
    },
  });

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
        t.paid_by?.display_name ?? "",
        t.status,
      ])
    );
    downloadCsv(`melza-${from}_${to}.csv`, csv);
  }

  return (
    <div className="page-pad space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            Relatórios
          </h1>
          <p className="text-sm text-muted-foreground">
            Extrato filtrado, comparativo e exportação
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={exportCsv}
          disabled={transactions.length === 0}
        >
          <Download className="mr-1.5 h-4 w-4" />
          CSV
        </Button>
      </div>

      {/* Comparativo mensal */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-border/60 bg-card/50">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Este mês ({formatMonthYear(now)})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-money text-xl font-semibold">
              {formatCurrency(compare.current)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/50">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Mês passado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-money text-xl font-semibold">
              {formatCurrency(compare.previous)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/50">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Variação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={`flex items-center gap-1.5 font-money text-xl font-semibold ${
                compare.delta > 0
                  ? "text-red-400"
                  : compare.delta < 0
                    ? "text-emerald-400"
                    : ""
              }`}
            >
              {compare.delta > 0 ? (
                <TrendingUp className="h-4 w-4" />
              ) : compare.delta < 0 ? (
                <TrendingDown className="h-4 w-4" />
              ) : null}
              {compare.delta >= 0 ? "+" : ""}
              {formatCurrency(compare.delta)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {compare.pct >= 0 ? "+" : ""}
              {compare.pct.toFixed(1)}% vs mês anterior
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros do extrato */}
      <div className="grid gap-3 rounded-xl border border-border/60 bg-card/40 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div className="space-y-1">
          <Label>De</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Até</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Cartão</Label>
          <Select value={cardId} onValueChange={setCardId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {cards.map((c) => (
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
        <div className="space-y-1">
          <Label>Tipo</Label>
          <Select value={txType} onValueChange={setTxType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="expense">Despesa</SelectItem>
              <SelectItem value="income">Receita</SelectItem>
              <SelectItem value="transfer">Transferência</SelectItem>
              <SelectItem value="loan_given">Empréstimo dado</SelectItem>
              <SelectItem value="loan_received">Empréstimo recebido</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <span>
          Despesas:{" "}
          <strong className="font-money text-red-400">
            {formatCurrency(expenseTotal)}
          </strong>
        </span>
        <span>
          Receitas:{" "}
          <strong className="font-money text-emerald-400">
            {formatCurrency(incomeTotal)}
          </strong>
        </span>
        <span className="text-muted-foreground">
          {transactions.length} lançamento(s)
        </span>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : transactions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum lançamento no período filtrado.
        </p>
      ) : (
        <ul className="divide-y divide-border/60 rounded-xl border border-border/60">
          {transactions.map((tx) => {
            const isExpense =
              tx.transaction_type === "expense" ||
              tx.transaction_type === "loan_given";
            const isIncome =
              tx.transaction_type === "income" ||
              tx.transaction_type === "loan_received";
            return (
              <li
                key={tx.id}
                className="flex flex-wrap items-center gap-3 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{tx.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(tx.transaction_date)}
                    {tx.paid_by ? ` · ${tx.paid_by.display_name}` : ""}
                    {tx.card ? ` · ${tx.card.name}` : ""}
                    {tx.account ? ` · ${tx.account.name}` : ""}
                  </p>
                </div>
                <CategoryBadge category={tx.category} />
                <p
                  className={`font-money text-sm font-semibold ${
                    isExpense
                      ? "text-red-400"
                      : isIncome
                        ? "text-emerald-400"
                        : ""
                  }`}
                >
                  {isExpense ? "−" : isIncome ? "+" : ""}
                  {formatCurrency(Number(tx.amount))}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      <CsvImportCard
        member={member}
        cards={cards}
        accounts={accounts}
      />
    </div>
  );
}
