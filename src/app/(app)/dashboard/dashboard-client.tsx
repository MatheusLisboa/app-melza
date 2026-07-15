"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  ChevronRight,
  CreditCard,
  FileText,
  History,
  Banknote,
  QrCode,
  Wallet,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  useAccounts,
  useWorkspaceMembers,
} from "@/lib/hooks/use-finance";
import type {
  WorkspaceMember,
  TransactionWithRelations,
  Subscription,
} from "@/types";
import type { MembershipOption } from "@/components/shared/workspace-switcher";
import {
  formatCurrency,
  formatDate,
  formatMonthYear,
  endOfMonth,
  startOfMonth,
  toISODate,
} from "@/lib/utils/format";
import {
  BalanceCard,
  Fab,
  TxRow,
  DsSkeleton,
  Avatar,
  toDsMember,
} from "@/components/design-system";
import { workspaceAccent } from "@/lib/utils/workspace";
import { setActiveWorkspaceAction } from "@/lib/actions/workspace";
import { TransactionFormDialog } from "@/components/transactions/transaction-form";
import { TransactionDetailSheet } from "@/components/transactions/transaction-detail-sheet";
import { DashboardCardsSection } from "@/components/dashboard/cards-overview";
import {
  paymentMethodCaption,
  resolvePaymentChannel,
} from "@/lib/utils/payment-channel";
import type { PaymentChannel } from "@/lib/validations/transaction";
import { collapseInstallmentPurchases } from "@/lib/finance/collapse-installments";
import { cn } from "@/lib/utils";

function greetingLabel(date = new Date()): string {
  const h = date.getHours();
  if (h < 5) return "Boa madrugada";
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function firstName(displayName: string): string {
  const part = displayName.trim().split(/\s+/)[0];
  return part || displayName;
}

function SectionHeader({
  title,
  subtitle,
  href,
  linkLabel = "Ver tudo",
  large = false,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  linkLabel?: string;
  large?: boolean;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h3
          className={cn(
            "tracking-tight text-[var(--color-text)]",
            large
              ? "text-[17px] font-semibold"
              : "text-[13px] font-medium uppercase tracking-wider text-[var(--color-text-2)]"
          )}
        >
          {title}
        </h3>
        {subtitle ? (
          <p className="mt-0.5 text-xs text-[var(--color-text-2)]">{subtitle}</p>
        ) : null}
      </div>
      {href ? (
        <Link
          href={href}
          className="shrink-0 text-[13px] font-medium text-[var(--color-text-2)] transition-colors hover:text-[var(--color-text)]"
        >
          {linkLabel}
        </Link>
      ) : null}
    </div>
  );
}

const SPEND_CHANNELS: {
  id: PaymentChannel;
  label: string;
  hint: string;
  icon: typeof QrCode;
}[] = [
  {
    id: "pix",
    label: "PIX",
    hint: "Saiu da conta na hora",
    icon: QrCode,
  },
  {
    id: "card",
    label: "Cartão",
    hint: "Vai na fatura",
    icon: CreditCard,
  },
  {
    id: "account",
    label: "Conta",
    hint: "Débito / transferência",
    icon: Wallet,
  },
  {
    id: "cash",
    label: "Dinheiro",
    hint: "Em espécie",
    icon: Banknote,
  },
];

/** Dashboard Make — PersonalDashboard (+ shared sections) */
export function DashboardClient({
  member,
  memberships = [],
}: {
  member: WorkspaceMember;
  memberships?: MembershipOption[];
}) {
  const [detailId, setDetailId] = useState<string | null>(null);
  const monthAnchor = useMemo(() => new Date(), []);
  const from = toISODate(startOfMonth(monthAnchor));
  const to = toISODate(endOfMonth(monthAnchor));
  const accent = workspaceAccent(member.workspace?.type);
  const isShared = member.workspace?.type !== "PERSONAL";

  const { data: accounts = [] } = useAccounts(member.workspace_id);
  const { data: members = [] } = useWorkspaceMembers(member.workspace_id);

  const { data: monthTx = [], isLoading } = useQuery({
    queryKey: ["dashboard", "month", member.workspace_id, from, to],
    staleTime: 30_000,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("transactions")
        .select(
          `
          id, amount, transaction_type, status, card_id, account_id, tags,
          category_id, paid_by_member_id, consumer_member_id, description,
          transaction_date, is_installment, installment_number, total_installments,
          category:categories(name, icon, color),
          card:cards(id, name, owner_member_id)
        `
        )
        .eq("workspace_id", member.workspace_id)
        .gte("transaction_date", from)
        .lte("transaction_date", to)
        .neq("status", "cancelled")
        .order("transaction_date", { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);
      return data as TransactionWithRelations[];
    },
  });

  /** Saldo: usa current_balance das contas. Fallback (txs) só se algum saldo for null. */
  const needsBalanceFallback = useMemo(() => {
    const active = accounts.filter((a) => a.is_active);
    if (!active.length) return false;
    return active.some((a) => a.current_balance == null);
  }, [accounts]);

  const { data: allAccountTx = [] } = useQuery({
    queryKey: ["dashboard", "balances", member.workspace_id],
    staleTime: 60_000,
    enabled: needsBalanceFallback,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("transactions")
        .select(
          "amount, transaction_type, account_id, transfer_to_account_id"
        )
        .eq("workspace_id", member.workspace_id)
        .not("account_id", "is", null)
        .neq("status", "cancelled")
        .neq("status", "scheduled")
        .limit(2000);
      if (error) throw error;
      return data as {
        amount: number;
        transaction_type: string;
        account_id: string;
        transfer_to_account_id: string | null;
      }[];
    },
  });

  const { data: upcoming = [] } = useQuery({
    queryKey: ["dashboard", "subs", member.workspace_id],
    staleTime: 2 * 60_000,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("workspace_id", member.workspace_id)
        .eq("is_active", true)
        .order("next_billing_date", { ascending: true })
        .limit(3);
      if (error) throw error;
      return (data ?? []) as Subscription[];
    },
  });

  /** Recentes: 90 dias (inclui fatura fora do mês civil) */
  const recentFrom = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    return toISODate(d);
  }, []);

  const { data: recentTx = [], isLoading: recentLoading } = useQuery({
    queryKey: ["dashboard", "recent", member.workspace_id, recentFrom],
    staleTime: 30_000,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("transactions")
        .select(
          `
          id, amount, transaction_type, status, card_id, account_id, tags,
          category_id, paid_by_member_id, consumer_member_id, description,
          transaction_date, is_installment, installment_number, total_installments,
          category:categories(name, icon, color),
          card:cards(id, name, owner_member_id)
        `
        )
        .eq("workspace_id", member.workspace_id)
        .gte("transaction_date", recentFrom)
        .neq("status", "cancelled")
        .order("transaction_date", { ascending: false })
        .limit(24);
      if (error) throw new Error(error.message);
      return data as TransactionWithRelations[];
    },
  });

  // ... later recent collapses to fewer rows — slice in useMemo


  const confirmedMonth = useMemo(
    () => monthTx.filter((t) => t.status !== "scheduled"),
    [monthTx]
  );

  const monthExpense = useMemo(
    () =>
      confirmedMonth
        .filter(
          (t) =>
            t.transaction_type === "expense" ||
            t.transaction_type === "loan_given"
        )
        .reduce((s, t) => s + Number(t.amount), 0),
    [confirmedMonth]
  );

  const monthIncome = useMemo(
    () =>
      confirmedMonth
        .filter(
          (t) =>
            t.transaction_type === "income" ||
            t.transaction_type === "loan_received"
        )
        .reduce((s, t) => s + Number(t.amount), 0),
    [confirmedMonth]
  );

  /** Preferência: soma dos saldos das contas. Fallback por txs só se current_balance null. */
  const consolidatedBalance = useMemo(() => {
    const active = accounts.filter((a) => a.is_active);
    const fromAccounts = active.reduce(
      (s, a) => s + Number(a.current_balance ?? 0),
      0
    );
    if (!needsBalanceFallback || allAccountTx.length === 0) {
      return fromAccounts;
    }

    const activeIds = new Set(active.map((a) => a.id));
    let balance = 0;
    for (const tx of allAccountTx) {
      if (!tx.account_id || !activeIds.has(tx.account_id)) continue;
      const amount = Number(tx.amount);
      const type = tx.transaction_type;
      if (type === "income" || type === "loan_received") {
        balance += amount;
      } else if (
        type === "expense" ||
        type === "loan_given" ||
        type === "loan_repayment"
      ) {
        balance -= amount;
      } else if (type === "transfer") {
        if (tx.transfer_to_account_id) balance -= amount;
        else balance += amount;
      }
    }
    return balance;
  }, [allAccountTx, accounts, needsBalanceFallback]);

  const byPerson = useMemo(() => {
    const map = new Map<string, { income: number; expenses: number }>();
    for (const m of members) {
      map.set(m.id, { income: 0, expenses: 0 });
    }
    for (const tx of confirmedMonth) {
      const key = tx.paid_by_member_id;
      if (!key || !map.has(key)) continue;
      const row = map.get(key)!;
      const amount = Number(tx.amount);
      if (
        tx.transaction_type === "expense" ||
        tx.transaction_type === "loan_given"
      ) {
        row.expenses += amount;
      } else if (
        tx.transaction_type === "income" ||
        tx.transaction_type === "loan_received"
      ) {
        row.income += amount;
      }
    }
    return members
      .map((m) => ({
        member: m,
        ...(map.get(m.id) ?? { income: 0, expenses: 0 }),
      }))
      .filter((r) => r.income > 0 || r.expenses > 0);
  }, [confirmedMonth, members]);

  const byCategory = useMemo(() => {
    const map = new Map<
      string,
      { name: string; emoji: string; color: string; total: number }
    >();
    for (const tx of confirmedMonth) {
      if (
        tx.transaction_type !== "expense" &&
        tx.transaction_type !== "loan_given"
      ) {
        continue;
      }
      const key = tx.category_id ?? "none";
      const prev = map.get(key) ?? {
        name: tx.category?.name ?? "Sem categoria",
        emoji: tx.category?.icon ?? "💸",
        color: tx.category?.color ?? "#c0c0c0",
        total: 0,
      };
      prev.total += Number(tx.amount);
      map.set(key, prev);
    }
    const rows = Array.from(map.values()).sort((a, b) => b.total - a.total);
    const max = rows[0]?.total || 1;
    return rows.slice(0, 4).map((r) => ({
      ...r,
      pct: Math.round((r.total / max) * 100),
    }));
  }, [confirmedMonth]);

  /** Despesas do mês agrupadas por forma de pagamento */
  const spendByChannel = useMemo(() => {
    const totals: Record<PaymentChannel, number> = {
      pix: 0,
      card: 0,
      account: 0,
      cash: 0,
    };
    let uncategorized = 0;

    for (const tx of confirmedMonth) {
      if (
        tx.transaction_type !== "expense" &&
        tx.transaction_type !== "loan_given"
      ) {
        continue;
      }
      const channel = resolvePaymentChannel(tx);
      if (channel) totals[channel] += Number(tx.amount);
      else uncategorized += Number(tx.amount);
    }

    const rows = SPEND_CHANNELS.map((c) => ({
      ...c,
      total: totals[c.id],
    })).filter((r) => r.total > 0);

    const cashOut = totals.pix + totals.account + totals.cash;
    const onCard = totals.card;

    return { rows, cashOut, onCard, uncategorized };
  }, [confirmedMonth]);

  const recent = useMemo(
    () => collapseInstallmentPurchases(recentTx).slice(0, 8),
    [recentTx]
  );
  const monthLabel = formatMonthYear(monthAnchor);
  const monthShort = monthAnchor
    .toLocaleDateString("pt-BR", { month: "short" })
    .replace(".", "")
    .toUpperCase();
  const todayLabel = monthAnchor.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
  const greet = greetingLabel(monthAnchor);
  const name = firstName(member.display_name);

  const sharedMemberships = memberships.filter(
    (m) =>
      m.workspace?.id &&
      m.workspace_id !== member.workspace_id &&
      m.workspace.type !== "PERSONAL"
  );
  const sharedCta =
    member.workspace?.type === "PERSONAL"
      ? sharedMemberships[0]
      : null;

  const quickLinks = [
    { href: "/invoices", label: "Faturas", icon: FileText },
    { href: "/cards", label: "Cartões", icon: CreditCard },
    { href: "/transactions", label: "Histórico", icon: History },
    { href: "/reports", label: "Relatórios", icon: BarChart3 },
  ] as const;

  return (
    <div className="relative pb-28 md:pb-8">
      {/* Saudação */}
      <div className="px-5 pt-3 md:px-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] capitalize text-[var(--color-text-2)]">
              {todayLabel}
            </p>
            <h1 className="mt-0.5 truncate text-[26px] font-semibold leading-tight tracking-tight text-[var(--color-text)]">
              {greet}, {name}
            </h1>
            {member.workspace?.name ? (
              <p className="mt-1 truncate text-[13px] text-[var(--color-text-2)]">
                {member.workspace.name}
                {isShared ? " · compartilhado" : ""}
              </p>
            ) : null}
          </div>
          <Avatar
            member={toDsMember({
              id: member.id,
              name: member.display_name,
              color: member.avatar_color,
              avatar_url: member.avatar_url,
            })}
            size={40}
          />
        </div>
      </div>

      {/* Saldo */}
      <div className="px-5 pt-4 md:px-6">
        <BalanceCard
          balance={consolidatedBalance}
          income={monthIncome}
          expenses={monthExpense}
          accentColor={accent.color}
          loading={isLoading && monthTx.length === 0}
          title={`Disponível · ${monthShort}`}
        />
      </div>

      {/* Atalhos */}
      <div className="mt-4 px-5 md:px-6">
        <div className="grid grid-cols-4 gap-2">
          {quickLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-1.5 rounded-[14px] border border-[var(--color-line)] bg-[var(--color-card)] px-1 py-3 transition-colors active:bg-[var(--color-chip)] hover:bg-[var(--color-chip)]"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-chip)]">
                <Icon
                  size={16}
                  strokeWidth={1.75}
                  className="text-[var(--color-text)]"
                />
              </div>
              <span className="text-[11px] font-medium text-[var(--color-text-2)]">
                {label}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {sharedCta?.workspace && (
        <div className="mt-4 px-5 md:px-6">
          <button
            type="button"
            onClick={async () => {
              await setActiveWorkspaceAction(sharedCta.workspace_id);
              window.location.assign("/dashboard");
            }}
            className="flex w-full items-center gap-3 rounded-[14px] border border-[var(--color-line)] bg-[var(--color-card)] p-3.5 text-left transition-colors hover:bg-[var(--color-chip)]"
          >
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl text-base"
              style={{
                background: `${workspaceAccent(sharedCta.workspace.type).color}18`,
              }}
            >
              {workspaceAccent(sharedCta.workspace.type).emoji}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium text-[var(--color-text)]">
                {sharedCta.workspace.name}
              </p>
              <p className="text-xs text-[var(--color-text-2)]">
                Abrir workspace compartilhado
              </p>
            </div>
            <ChevronRight size={16} className="text-[var(--color-text-3)]" />
          </button>
        </div>
      )}

      <DashboardCardsSection member={member} />

      {/* Como pagou este mês */}
      {(spendByChannel.cashOut > 0 ||
        spendByChannel.onCard > 0 ||
        spendByChannel.rows.length > 0) && (
        <div className="mt-6 px-5 md:px-6">
          <SectionHeader
            title="Como você pagou"
            subtitle={monthLabel}
          />

          <div className="mb-2.5 grid grid-cols-2 gap-2.5">
            <div className="rounded-[14px] border border-[var(--color-line)] bg-[var(--color-card)] p-3.5">
              <div className="mb-2 flex items-center gap-1.5">
                <QrCode className="h-3.5 w-3.5 text-[var(--color-text-2)]" />
                <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-2)]">
                  Saiu da conta
                </span>
              </div>
              <p className="font-mono text-[17px] font-semibold text-[var(--color-text)]">
                {formatCurrency(spendByChannel.cashOut)}
              </p>
              <p className="mt-1 text-[11px] text-[var(--color-text-2)]">
                PIX, débito e dinheiro
              </p>
            </div>
            <div className="rounded-[14px] border border-[var(--color-line)] bg-[var(--color-card)] p-3.5">
              <div className="mb-2 flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5 text-[var(--color-text-2)]" />
                <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-2)]">
                  No cartão
                </span>
              </div>
              <p className="font-mono text-[17px] font-semibold text-[var(--color-text)]">
                {formatCurrency(spendByChannel.onCard)}
              </p>
              <p className="mt-1 text-[11px] text-[var(--color-text-2)]">
                Compras na fatura
              </p>
            </div>
          </div>

          {spendByChannel.rows.length > 0 && (
            <div className="overflow-hidden rounded-[14px] border border-[var(--color-line)] bg-[var(--color-card)]">
              {spendByChannel.rows.map((row, i) => {
                const Icon = row.icon;
                const pct =
                  monthExpense > 0
                    ? Math.round((row.total / monthExpense) * 100)
                    : 0;
                return (
                  <div
                    key={row.id}
                    className={cn(
                      "px-4 py-3.5",
                      i > 0 && "border-t border-[var(--color-line)]"
                    )}
                  >
                    <div className="mb-2 flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-chip)]">
                        <Icon className="h-3.5 w-3.5 text-[var(--color-text)]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-medium text-[var(--color-text)]">
                          {row.label}
                        </p>
                        <p className="text-[11px] text-[var(--color-text-2)]">
                          {row.hint}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-[13px] font-medium text-[var(--color-text)]">
                          {formatCurrency(row.total)}
                        </p>
                        <p className="text-[10px] text-[var(--color-text-2)]">
                          {pct}%
                        </p>
                      </div>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-[var(--color-chip)]">
                      <div
                        className="h-full rounded-full bg-[var(--color-text)]/35 transition-all duration-300"
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Shared: por membro */}
      {isShared && byPerson.length > 0 && (
        <div className="mt-6 px-5 md:px-6">
          <SectionHeader title="Por membro" subtitle={monthLabel} />
          <div className="flex flex-col gap-2.5">
            {byPerson.map(({ member: m, income, expenses }) => {
              const saved = income - expenses;
              const pct =
                income > 0 ? Math.round((expenses / income) * 100) : 0;
              return (
                <div
                  key={m.id}
                  className="rounded-[14px] border border-[var(--color-line)] bg-[var(--color-card)] p-4"
                >
                  <div className="mb-3 flex items-center gap-3">
                    <Avatar
                      member={toDsMember({
                        id: m.id,
                        name: m.display_name,
                        color: m.avatar_color,
                      })}
                      size={36}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium text-[var(--color-text)]">
                        {m.display_name}
                      </p>
                      <p className="text-xs text-[var(--color-text-2)]">
                        {saved >= 0 ? "Guardou" : "Gastou a mais"}{" "}
                        {formatCurrency(Math.abs(saved))} este mês
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-[13px] font-medium text-[var(--color-text)]">
                        {formatCurrency(expenses)}
                      </p>
                      <p className="text-[10px] text-[var(--color-text-2)]">
                        gastos
                      </p>
                    </div>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-chip)]">
                    <div
                      className="h-full rounded-full bg-[var(--color-text)]/35 transition-all duration-300"
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-[10px] text-[var(--color-text-3)]">
                    {pct}% da renda comprometida
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Categorias */}
      {byCategory.length > 0 && (
        <div className="mt-6 px-5 md:px-6">
          <SectionHeader
            title="Categorias"
            subtitle={`Maiores gastos · ${monthLabel}`}
            href="/reports"
            linkLabel="Relatório"
          />
          <div className="overflow-hidden rounded-[14px] border border-[var(--color-line)] bg-[var(--color-card)] px-4 py-1">
            {byCategory.map(({ emoji, name: catName, total, pct }, i) => (
              <div
                key={catName}
                className={cn(
                  "py-3",
                  i > 0 && "border-t border-[var(--color-line)]"
                )}
              >
                <div className="mb-1.5 flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-chip)] text-base">
                    {emoji}
                  </span>
                  <p className="flex-1 text-[14px] font-medium text-[var(--color-text)]">
                    {catName}
                  </p>
                  <span className="font-mono text-[13px] font-medium text-[var(--color-text)]">
                    {formatCurrency(total)}
                  </span>
                </div>
                <div className="ml-11 h-1 overflow-hidden rounded-full bg-[var(--color-chip)]">
                  <div
                    className="h-full rounded-full bg-[var(--color-text)]/35"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Próximas contas */}
      <div className="mt-6 px-5 md:px-6">
        <SectionHeader
          title="Próximas contas"
          large
          href="/subscriptions"
          linkLabel="Ver todas"
        />
        {upcoming.length === 0 ? (
          <div className="rounded-[14px] border border-dashed border-[var(--color-line)] bg-[var(--color-card)] px-4 py-5">
            <p className="text-sm text-[var(--color-text-2)]">
              Nenhuma assinatura próxima.
            </p>
            <Link
              href="/subscriptions"
              className="mt-1 inline-block text-[13px] font-medium text-[var(--color-text)] underline-offset-2 hover:underline"
            >
              Cadastrar assinatura
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[14px] border border-[var(--color-line)] bg-[var(--color-card)]">
            {upcoming.map((item, i) => (
              <div
                key={item.id}
                className={cn(
                  "flex items-center gap-3 px-4 py-3.5",
                  i > 0 && "border-t border-[var(--color-line)]"
                )}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-chip)] text-base">
                  🔁
                </div>
                <p className="min-w-0 flex-1 truncate text-[14px] font-medium text-[var(--color-text)]">
                  {item.name}
                </p>
                <div className="text-right">
                  <p className="font-mono text-[13px] font-medium text-[var(--color-text)]">
                    {formatCurrency(Number(item.amount))}
                  </p>
                  <p className="text-[11px] text-[var(--color-text-2)]">
                    {item.next_billing_date
                      ? formatDate(item.next_billing_date)
                      : "—"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recentes / Timeline */}
      <div className="mt-6 px-5 md:px-6">
        <SectionHeader
          title={isShared ? "Timeline" : "Últimas transações"}
          large
          href="/transactions"
          linkLabel="Ver todas"
        />
        {recentLoading ? (
          <div className="overflow-hidden rounded-[14px] border border-[var(--color-line)] bg-[var(--color-card)] p-4">
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <DsSkeleton h="h-9" w="w-9" className="rounded-full" />
                  <div className="flex flex-1 flex-col gap-1.5">
                    <DsSkeleton h="h-3.5" w="w-32" />
                    <DsSkeleton h="h-3" w="w-20" />
                  </div>
                  <DsSkeleton h="h-3.5" w="w-16" />
                </div>
              ))}
            </div>
          </div>
        ) : recent.length === 0 ? (
          <div className="rounded-[14px] border border-dashed border-[var(--color-line)] bg-[var(--color-card)] px-4 py-5">
            <p className="text-sm text-[var(--color-text-2)]">
              Nenhum lançamento recente.
            </p>
            <p className="mt-1 text-[12px] text-[var(--color-text-3)]">
              Toque no + para registrar a primeira despesa.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[14px] border border-[var(--color-line)] bg-[var(--color-card)]">
            {recent.map((tx, i) => {
              const payerMember = members.find(
                (m) => m.id === tx.paid_by_member_id
              );
              const consumerMember = members.find(
                (m) => m.id === tx.consumer_member_id
              );
              const payer = payerMember ? toDsMember(payerMember) : null;
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
                    i > 0 && "border-t border-[var(--color-line)]"
                  )}
                >
                  <TxRow
                    embedded
                    emoji={tx.category?.icon}
                    title={tx.displayDescription}
                    category={tx.category?.name}
                    paymentLabel={paymentMethodCaption(tx)}
                    dateLabel={formatDate(tx.transaction_date)}
                    amount={tx.displayAmount}
                    type={
                      isIncome ? "income" : isExpense ? "expense" : "other"
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

