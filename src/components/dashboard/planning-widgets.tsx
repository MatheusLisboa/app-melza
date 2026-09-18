"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { WorkspaceMember } from "@/types";
import { useAccounts, useCards } from "@/lib/hooks/use-finance";
import {
  useCategoryBudgets,
  useMonthCloses,
  useSavingsGoals,
} from "@/lib/hooks/use-planning";
import {
  formatCurrency,
  startOfMonth,
  endOfMonth,
  toISODate,
} from "@/lib/utils/format";
import {
  projectMonth,
  yearMonthOf,
} from "@/lib/finance/month-projection";
import { getCurrentInvoiceCycle } from "@/lib/finance/card-cycle";
import { cn } from "@/lib/utils";

export function SetupChecklist({
  member,
}: {
  member: WorkspaceMember;
}) {
  const { data: accounts = [] } = useAccounts(member.workspace_id);
  const { data: cards = [] } = useCards(member.workspace_id);
  const [hidden, setHidden] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(`melza-setup-done:${member.workspace_id}`) === "1";
  });

  const { data: txCount } = useQuery({
    queryKey: ["dashboard", "setup-tx", member.workspace_id],
    staleTime: 60_000,
    queryFn: async () => {
      const supabase = createClient();
      const { count, error } = await supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", member.workspace_id)
        .neq("status", "cancelled");
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: budgets = [] } = useCategoryBudgets(member.workspace_id);

  const steps = [
    {
      done: accounts.some((a) => a.is_active),
      label: "Adicionar uma conta",
      href: "/accounts",
    },
    {
      done: cards.some((c) => c.is_active),
      label: "Cadastrar um cartão",
      href: "/cards",
    },
    {
      done: (txCount ?? 0) > 0,
      label: "Registrar o primeiro gasto",
      href: "/transactions",
    },
    {
      done: budgets.length > 0,
      label: "Definir um orçamento",
      href: "/planning",
    },
  ];

  const pending = steps.filter((s) => !s.done);
  if (hidden || pending.length === 0) return null;

  return (
    <div className="mt-4 px-5 md:px-6">
      <div className="rounded-[14px] border border-[var(--color-line)] bg-[var(--color-card)] p-4">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <p className="text-[14px] font-semibold">Comece por aqui</p>
            <p className="text-[12px] text-[var(--color-text-2)]">
              {pending.length} passo{pending.length > 1 ? "s" : ""} para o app
              fazer sentido
            </p>
          </div>
          <button
            type="button"
            className="text-[12px] text-[var(--color-text-3)]"
            onClick={() => {
              localStorage.setItem(
                `melza-setup-done:${member.workspace_id}`,
                "1"
              );
              setHidden(true);
            }}
          >
            Dispensar
          </button>
        </div>
        <ul className="space-y-2">
          {steps.map((s) => (
            <li key={s.href + s.label}>
              <Link
                href={s.href}
                className={cn(
                  "flex items-center gap-2 text-[13px]",
                  s.done
                    ? "text-[var(--color-text-3)] line-through"
                    : "font-medium text-[var(--color-text)]"
                )}
              >
                <span
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded-full border text-[10px]",
                    s.done
                      ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-white"
                      : "border-[var(--color-line)]"
                  )}
                >
                  {s.done ? "✓" : ""}
                </span>
                {s.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function MonthProjectionCard({
  member,
  balance,
}: {
  member: WorkspaceMember;
  balance: number;
}) {
  const now = useMemo(() => new Date(), []);
  const from = toISODate(now);
  const until = toISODate(endOfMonth(now));
  const monthFrom = toISODate(startOfMonth(now));
  const { data: cards = [] } = useCards(member.workspace_id);

  const { data: subs = [] } = useQuery({
    queryKey: ["subscriptions", member.workspace_id, "projection"],
    staleTime: 60_000,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("subscriptions")
        .select("amount, kind, next_billing_date, is_active")
        .eq("workspace_id", member.workspace_id)
        .eq("is_active", true);
      if (error) throw error;
      return (data ?? []) as {
        amount: number;
        kind: "expense" | "income" | null;
        next_billing_date: string | null;
        is_active: boolean;
      }[];
    },
  });

  const activeCards = cards.filter((c) => c.is_active && c.card_type === "credit");
  const cycles = activeCards
    .map((c) => getCurrentInvoiceCycle(c))
    .filter(Boolean);

  const invoiceRange = useMemo(() => {
    let fromD = monthFrom;
    let toD = until;
    for (const c of cycles) {
      if (c && c.from < fromD) fromD = c.from;
      if (c && c.to > toD) toD = c.to;
    }
    return { from: fromD, to: toD };
  }, [cycles, monthFrom, until]);

  const { data: invoiceTx = [] } = useQuery({
    queryKey: [
      "dashboard",
      "invoice-remain",
      member.workspace_id,
      invoiceRange.from,
      invoiceRange.to,
    ],
    enabled: activeCards.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("transactions")
        .select("amount, card_id, transaction_type, status, transaction_date")
        .eq("workspace_id", member.workspace_id)
        .in(
          "card_id",
          activeCards.map((c) => c.id)
        )
        .neq("status", "cancelled")
        .gte("transaction_date", invoiceRange.from)
        .lte("transaction_date", invoiceRange.to);
      if (error) throw error;
      return (data ?? []) as {
        amount: number;
        card_id: string | null;
        transaction_type: string;
        status: string;
        transaction_date: string;
      }[];
    },
  });

  const invoiceRemaining = useMemo(() => {
    let total = 0;
    for (const card of activeCards) {
      const cycle = getCurrentInvoiceCycle(card);
      if (!cycle) continue;
      const dueISO = cycle.to;
      if (dueISO < from) continue;
      const spend = invoiceTx
        .filter(
          (t) =>
            t.card_id === card.id &&
            t.transaction_date >= cycle.from &&
            t.transaction_date <= cycle.to &&
            t.transaction_type !== "income" &&
            t.status !== "scheduled"
        )
        .reduce((s, t) => s + Number(t.amount), 0);
      total += spend;
    }
    return total;
  }, [activeCards, invoiceTx, from]);

  const projection = projectMonth({
    balance,
    invoiceRemaining,
    recurrings: subs,
    fromISO: from,
    untilISO: until,
  });

  const { data: closes = [] } = useMonthCloses(member.workspace_id);
  const closed = closes.some((c) => c.year_month === yearMonthOf(now));

  return (
    <div className="mt-4 px-5 md:px-6">
      <Link
        href="/planning"
        className="block rounded-[14px] border border-[var(--color-line)] bg-[var(--color-card)] p-4 transition-colors hover:bg-[var(--color-chip)]"
      >
        <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-2)]">
          Até o fim do mês
        </p>
        <p
          className={cn(
            "mt-1.5 font-mono text-[22px] font-extrabold",
            projection.leftover >= 0
              ? "text-[var(--color-text)]"
              : "text-[var(--color-expense)]"
          )}
        >
          {formatCurrency(projection.leftover)}
        </p>
        <p className="mt-1 text-[12px] text-[var(--color-text-2)]">
          Saldo {formatCurrency(projection.balance)}
          {projection.billsLeft > 0
            ? ` · contas ${formatCurrency(projection.billsLeft)}`
            : ""}
          {projection.incomeLeft > 0
            ? ` · a receber ${formatCurrency(projection.incomeLeft)}`
            : ""}
        </p>
        {closed ? (
          <p className="mt-2 text-[11px] text-[var(--color-text-3)]">
            Este mês já foi fechado
          </p>
        ) : (
          <p className="mt-2 text-[11px] font-medium text-[var(--color-text)]">
            Planejamento e fechar mês →
          </p>
        )}
      </Link>
    </div>
  );
}

export function GoalsPeek({ member }: { member: WorkspaceMember }) {
  const { data: goals = [] } = useSavingsGoals(member.workspace_id);
  const active = goals.filter((g) => g.is_active).slice(0, 2);
  if (active.length === 0) return null;
  return (
    <div className="mt-6 px-5 md:px-6">
      <div className="mb-3 flex items-end justify-between">
        <h3 className="text-[17px] font-semibold">Metas</h3>
        <Link
          href="/planning"
          className="text-[13px] font-medium text-[var(--color-text-2)] hover:text-[var(--color-text)]"
        >
          Ver
        </Link>
      </div>
      <div className="flex flex-col gap-2">
        {active.map((g) => {
          const pct = Math.min(
            100,
            Math.round(
              (Number(g.current_amount) / Number(g.target_amount)) * 100
            )
          );
          return (
            <div
              key={g.id}
              className="rounded-[14px] border border-[var(--color-line)] bg-[var(--color-card)] p-3.5"
            >
              <div className="mb-1.5 flex justify-between text-[13px]">
                <span className="font-medium">{g.name}</span>
                <span className="font-mono text-[12px] text-[var(--color-text-2)]">
                  {pct}%
                </span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-[var(--color-chip)]">
                <div
                  className="h-full rounded-full bg-[var(--color-ink)]"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
