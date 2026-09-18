"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Repeat, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { WorkspaceMember } from "@/types";
import { useCategoryBudgets } from "@/lib/hooks/use-planning";
import { formatCurrency, formatDate, toISODate } from "@/lib/utils/format";
import { topCategoryInsight } from "@/lib/finance/insights";
import { cn } from "@/lib/utils";
import { CategoryGlyph } from "@/lib/ui/category-icon";
import { loadTxTemplates, type LastTxTemplate } from "@/lib/ui/last-pay";

export function MonthInsight({
  current,
  previous,
}: {
  current: { name: string; total: number }[];
  previous: { name: string; total: number }[];
}) {
  const insight = useMemo(
    () => topCategoryInsight(current, previous),
    [current, previous]
  );
  if (!insight) return null;
  const up = insight.delta > 0;
  return (
    <p className="mt-2 text-[12px] text-[var(--color-text-2)]">
      {insight.name} {up ? "+" : ""}
      {Math.round(insight.pct)}% vs mês passado
    </p>
  );
}

export function BudgetAlert({
  member,
  spentByCat,
}: {
  member: WorkspaceMember;
  spentByCat: Map<string, number>;
}) {
  const { data: budgets = [] } = useCategoryBudgets(member.workspace_id);
  const hot = budgets
    .map((b) => {
      const spent = spentByCat.get(b.category_id) ?? 0;
      const cap = Number(b.amount);
      const pct = cap > 0 ? Math.round((spent / cap) * 100) : 0;
      return { ...b, spent, cap, pct };
    })
    .filter((b) => b.pct >= 80)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 2);

  if (hot.length === 0) return null;
  return (
    <div className="mt-4 space-y-2 px-5 md:px-6">
      {hot.map((b) => (
        <Link
          key={b.id}
          href="/planning"
          className={cn(
            "block rounded-[14px] border px-4 py-3",
            b.pct >= 100
              ? "border-[var(--color-expense)]/30 bg-[var(--color-expense)]/8"
              : "border-[var(--color-line)] bg-[var(--color-card)]"
          )}
        >
          <p className="text-[13px] font-medium text-[var(--color-text)]">
            {b.category?.name ?? "Categoria"} · {b.pct}% do teto
          </p>
          <p className="mt-0.5 text-[12px] text-[var(--color-text-2)]">
            {formatCurrency(b.spent)} de {formatCurrency(b.cap)}
          </p>
        </Link>
      ))}
    </div>
  );
}

export function TodayAgenda({
  member,
}: {
  member: WorkspaceMember;
}) {
  const today = toISODate(new Date());
  const limit = new Date();
  limit.setDate(limit.getDate() + 3);
  const until = toISODate(limit);

  const { data: items = [] } = useQuery({
    queryKey: ["dashboard", "today", member.workspace_id, today],
    staleTime: 60_000,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("subscriptions")
        .select("id, name, amount, next_billing_date, kind, is_active")
        .eq("workspace_id", member.workspace_id)
        .eq("is_active", true)
        .gte("next_billing_date", today)
        .lte("next_billing_date", until)
        .order("next_billing_date");
      if (error) throw error;
      return (data ?? []) as {
        id: string;
        name: string;
        amount: number;
        next_billing_date: string | null;
        kind?: "income" | "expense" | null;
        is_active: boolean;
      }[];
    },
  });

  if (items.length === 0) return null;

  return (
    <div className="mt-5 px-5 md:px-6">
      <div className="mb-2.5 flex items-end justify-between">
        <h3 className="text-title">Hoje</h3>
        <Link
          href="/subscriptions"
          className="text-[13px] font-medium text-[var(--color-text-2)]"
        >
          Agenda
        </Link>
      </div>
      <div className="overflow-hidden rounded-[14px] border border-[var(--color-line)] bg-[var(--color-card)]">
        {items.map((item, i) => {
          const isIncome = item.kind === "income";
          const when =
            item.next_billing_date === today
              ? "hoje"
              : formatDate(item.next_billing_date ?? today);
          return (
            <div
              key={item.id}
              className={cn(
                "flex items-center gap-3 px-4 py-3",
                i > 0 && "border-t border-[var(--color-line)]"
              )}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-chip)]">
                {isIncome ? (
                  <Wallet size={16} className="text-[var(--color-text)]" />
                ) : (
                  <Repeat size={16} className="text-[var(--color-text)]" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium">{item.name}</p>
                <p className="text-[11px] text-[var(--color-text-2)]">{when}</p>
              </div>
              <p
                className={cn(
                  "font-mono text-[13px] font-medium",
                  isIncome ? "text-[var(--color-income)]" : "text-[var(--color-text)]"
                )}
              >
                {isIncome ? "+" : ""}
                {formatCurrency(Number(item.amount))}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function RepeatTemplates({
  workspaceId,
  onPick,
}: {
  workspaceId: string;
  onPick: (t: LastTxTemplate) => void;
}) {
  const templates = useMemo(() => loadTxTemplates(workspaceId), [workspaceId]);
  if (templates.length === 0) return null;
  return (
    <div className="mt-4 px-5 md:px-6">
      <p className="mb-2 text-[12px] font-medium text-[var(--color-text-2)]">
        De novo
      </p>
      <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {templates.map((t) => (
          <button
            key={t.description + t.amount}
            type="button"
            onClick={() => onPick(t)}
            className="shrink-0 rounded-full border border-[var(--color-line)] bg-[var(--color-card)] px-3 py-1.5 text-[13px] font-medium"
          >
            {t.description} · {formatCurrency(t.amount)}
          </button>
        ))}
      </div>
    </div>
  );
}

export function CategoryRows({
  rows,
}: {
  rows: { name: string; emoji?: string; total: number; pct: number }[];
}) {
  if (rows.length === 0) return null;
  return (
    <div className="overflow-hidden rounded-[14px] border border-[var(--color-line)] bg-[var(--color-card)] px-4 py-1">
      {rows.slice(0, 3).map((r, i) => (
        <div
          key={r.name}
          className={cn("py-3", i > 0 && "border-t border-[var(--color-line)]")}
        >
          <div className="mb-1.5 flex items-center gap-3">
            <CategoryGlyph
              name={r.name}
              emoji={r.emoji}
              className="h-8 w-8 rounded-lg"
              size={14}
            />
            <p className="flex-1 text-[14px] font-medium">{r.name}</p>
            <span className="font-mono text-[13px] font-medium">
              {formatCurrency(r.total)}
            </span>
          </div>
          <div className="ml-11 h-1 overflow-hidden rounded-full bg-[var(--color-chip)]">
            <div
              className="h-full rounded-full bg-[var(--color-ink)] dark:bg-[var(--color-pearl)]"
              style={{ width: `${r.pct}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
