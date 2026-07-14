"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
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
import {
  paymentMethodCaption,
  resolvePaymentChannel,
} from "@/lib/utils/payment-channel";
import type { PaymentChannel } from "@/lib/validations/transaction";
import { Banknote, CreditCard, QrCode, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const SPEND_CHANNELS: {
  id: PaymentChannel;
  label: string;
  hint: string;
  color: string;
  icon: typeof QrCode;
}[] = [
  {
    id: "pix",
    label: "PIX",
    hint: "Saiu da conta na hora",
    color: "#22C55E",
    icon: QrCode,
  },
  {
    id: "card",
    label: "Cartão",
    hint: "Vai na fatura",
    color: "#6366F1",
    icon: CreditCard,
  },
  {
    id: "account",
    label: "Conta",
    hint: "Débito / transferência",
    color: "#06B6D4",
    icon: Wallet,
  },
  {
    id: "cash",
    label: "Dinheiro",
    hint: "Em espécie",
    color: "#F59E0B",
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
  const monthAnchor = useMemo(() => new Date(), []);
  const from = toISODate(startOfMonth(monthAnchor));
  const to = toISODate(endOfMonth(monthAnchor));
  const accent = workspaceAccent(member.workspace?.type);
  const isShared = member.workspace?.type !== "PERSONAL";

  const { data: accounts = [] } = useAccounts(member.workspace_id);
  const { data: members = [] } = useWorkspaceMembers(member.workspace_id);

  const { data: monthTx = [], isLoading } = useQuery({
    queryKey: ["dashboard", "month", member.workspace_id, from, to],
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("transactions")
        .select(
          `
          *,
          category:categories(*),
          card:cards(*),
          account:accounts(*),
          paid_by:workspace_members!paid_by_member_id(*),
          consumer:workspace_members!consumer_member_id(*)
        `
        )
        .eq("workspace_id", member.workspace_id)
        .gte("transaction_date", from)
        .lte("transaction_date", to)
        .neq("status", "cancelled")
        .order("transaction_date", { ascending: false });
      if (error) throw error;
      return data as TransactionWithRelations[];
    },
  });

  const { data: allAccountTx = [] } = useQuery({
    queryKey: ["dashboard", "balances", member.workspace_id],
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("transactions")
        .select(
          "amount, transaction_type, account_id, transfer_to_account_id, status"
        )
        .eq("workspace_id", member.workspace_id)
        .not("account_id", "is", null)
        .neq("status", "cancelled")
        .neq("status", "scheduled");
      if (error) throw error;
      return data as {
        amount: number;
        transaction_type: string;
        account_id: string;
        transfer_to_account_id: string | null;
        status: string;
      }[];
    },
  });

  const { data: upcoming = [] } = useQuery({
    queryKey: ["dashboard", "subs", member.workspace_id],
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

  /** Dinheiro nas contas (PIX/débito/dinheiro). Cartão NÃO entra — fatura ainda não saiu. */
  const consolidatedBalance = useMemo(() => {
    const activeIds = new Set(
      accounts.filter((a) => a.is_active).map((a) => a.id)
    );
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
        // saída (tem destino): −origem; entrada (sem destino): +conta
        if (tx.transfer_to_account_id) {
          balance -= amount;
        } else {
          balance += amount;
        }
      }
    }
    return balance;
  }, [allAccountTx, accounts]);

  const monthResult = monthIncome - monthExpense;

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
        color: tx.category?.color ?? "#6366F1",
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

  const recent = confirmedMonth.slice(0, 5);
  const monthLabel = formatMonthYear(monthAnchor);

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

  const trendLabel =
    monthIncome === 0 && monthExpense === 0
      ? "Sem movimento este mês"
      : monthResult >= 0
        ? `Resultado do mês +${formatCurrency(monthResult)}`
        : `Resultado do mês −${formatCurrency(Math.abs(monthResult))}`;

  return (
    <div className="relative pb-28 md:pb-8">
      <div className="px-5 pt-2">
        <BalanceCard
          balance={consolidatedBalance}
          income={monthIncome}
          expenses={monthExpense}
          accentColor={accent.color}
          loading={isLoading && monthTx.length === 0}
          trendLabel={trendLabel}
          trendPositive={monthResult >= 0}
          title={isShared ? "Nas contas" : "Nas contas"}
          subtitle="PIX, débito e dinheiro · cartão não abate o saldo"
        />
      </div>

      {sharedCta?.workspace && (
        <div className="px-5 mt-3">
          <button
            type="button"
            onClick={async () => {
              await setActiveWorkspaceAction(sharedCta.workspace_id);
              window.location.assign("/dashboard");
            }}
            className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.06] bg-[#111113] p-3.5 text-left transition-colors hover:bg-[#141417]"
          >
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl text-base"
              style={{
                background: `${workspaceAccent(sharedCta.workspace.type).color}15`,
              }}
            >
              {workspaceAccent(sharedCta.workspace.type).emoji}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-white/80">
                {sharedCta.workspace.name}
              </p>
              <p className="text-xs text-white/30">
                Ver dashboard compartilhado
              </p>
            </div>
            <ChevronRight size={16} className="text-white/25" />
          </button>
        </div>
      )}

      {/* Como pagou este mês */}
      {(spendByChannel.cashOut > 0 ||
        spendByChannel.onCard > 0 ||
        spendByChannel.rows.length > 0) && (
        <div className="px-5 mt-6">
          <div className="mb-3 flex items-end justify-between gap-2">
            <div>
              <h3 className="text-[13px] font-semibold uppercase tracking-wider text-white/60">
                Como você pagou
              </h3>
              <p className="mt-0.5 text-xs capitalize text-white/30">
                {monthLabel}
              </p>
            </div>
          </div>

          <div className="mb-3 grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-white/[0.06] bg-[#111113] p-3.5">
              <div className="mb-2 flex items-center gap-1.5">
                <QrCode className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-[10px] font-medium uppercase tracking-wide text-white/35">
                  Saiu da conta
                </span>
              </div>
              <p className="font-mono text-[17px] font-semibold text-white/90">
                {formatCurrency(spendByChannel.cashOut)}
              </p>
              <p className="mt-1 text-[11px] text-white/30">
                PIX, débito e dinheiro
              </p>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-[#111113] p-3.5">
              <div className="mb-2 flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5 text-indigo-400" />
                <span className="text-[10px] font-medium uppercase tracking-wide text-white/35">
                  No cartão
                </span>
              </div>
              <p className="font-mono text-[17px] font-semibold text-white/90">
                {formatCurrency(spendByChannel.onCard)}
              </p>
              <p className="mt-1 text-[11px] text-white/30">
                Compras na fatura
              </p>
            </div>
          </div>

          {spendByChannel.rows.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#111113]">
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
                      i > 0 && "border-t border-white/[0.05]"
                    )}
                  >
                    <div className="mb-2 flex items-center gap-3">
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-xl"
                        style={{ backgroundColor: `${row.color}18` }}
                      >
                        <Icon
                          className="h-3.5 w-3.5"
                          style={{ color: row.color }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-medium text-white/85">
                          {row.label}
                        </p>
                        <p className="text-[11px] text-white/30">{row.hint}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-[13px] font-semibold text-white/75">
                          {formatCurrency(row.total)}
                        </p>
                        <p className="text-[10px] text-white/30">{pct}%</p>
                      </div>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-white/[0.05]">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(pct, 100)}%`,
                          backgroundColor: row.color,
                        }}
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
        <div className="px-5 mt-6">
          <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-white/60">
            Por membro
          </h3>
          <div className="flex flex-col gap-2">
            {byPerson.map(({ member: m, income, expenses }) => {
              const saved = income - expenses;
              const pct =
                income > 0 ? Math.round((expenses / income) * 100) : 0;
              return (
                <div
                  key={m.id}
                  className="rounded-2xl border border-white/[0.06] bg-[#111113] p-4"
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
                    <div>
                      <p className="text-[14px] font-semibold text-white/90">
                        {m.display_name}
                      </p>
                      <p className="text-xs text-white/30">
                        Guardou {formatCurrency(saved)} este mês
                      </p>
                    </div>
                    <div className="ml-auto text-right">
                      <p className="font-mono text-[13px] font-semibold text-white/65">
                        {formatCurrency(expenses)}
                      </p>
                      <p className="text-[10px] text-white/30">gastos</p>
                    </div>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(pct, 100)}%`,
                        backgroundColor: m.avatar_color,
                      }}
                    />
                  </div>
                  <p className="mt-1.5 text-[10px] text-white/25">
                    {pct}% da renda comprometida
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Categorias — pessoal e compartilhado */}
      {byCategory.length > 0 && (
        <div className="px-5 mt-6">
          <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-white/60">
            Categorias
          </h3>
          <div className="flex flex-col gap-0.5">
            {byCategory.map(({ emoji, name, total, pct, color }) => (
              <div key={name} className="py-2.5">
                <div className="mb-1.5 flex items-center gap-3">
                  <span className="text-base">{emoji}</span>
                  <p className="flex-1 text-[14px] font-medium text-white/80">
                    {name}
                  </p>
                  <span className="font-mono text-[13px] font-semibold text-white/65">
                    {formatCurrency(total)}
                  </span>
                </div>
                <div className="ml-8 h-1 overflow-hidden rounded-full bg-white/[0.05]">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Próximas contas */}
      <div className="px-5 mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[13px] font-semibold uppercase tracking-wider text-white/60">
            Próximas contas
          </h3>
          <Link
            href="/subscriptions"
            className="text-xs font-medium"
            style={{ color: accent.color }}
          >
            Ver tudo
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <p className="py-2 text-sm text-white/30">Nenhuma assinatura próxima.</p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {upcoming.map((item) => (
              <div key={item.id} className="flex items-center gap-3 py-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1C1C1F] text-base">
                  🔁
                </div>
                <p className="flex-1 text-[14px] font-medium text-white/80">
                  {item.name}
                </p>
                <div className="text-right">
                  <p className="font-mono text-[13px] font-semibold text-white/65">
                    {formatCurrency(Number(item.amount))}
                  </p>
                  <p className="text-[11px] text-white/30">
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
      <div className="px-5 mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[13px] font-semibold uppercase tracking-wider text-white/60">
            {isShared ? "Timeline" : "Recentes"}
          </h3>
          <Link
            href="/transactions"
            className="text-xs font-medium"
            style={{ color: accent.color }}
          >
            Ver tudo
          </Link>
        </div>
        {isLoading ? (
          <div className="flex flex-col gap-3 pt-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <DsSkeleton h="h-10" w="w-10" className="rounded-xl" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <DsSkeleton h="h-3.5" w="w-32" />
                  <DsSkeleton h="h-3" w="w-20" />
                </div>
                <DsSkeleton h="h-3.5" w="w-16" />
              </div>
            ))}
          </div>
        ) : recent.length === 0 ? (
          <p className="py-2 text-sm text-white/30">Nenhum lançamento este mês.</p>
        ) : (
          recent.map((tx) => {
            const payer = tx.paid_by ? toDsMember(tx.paid_by) : null;
            const consumer = tx.consumer
              ? toDsMember(tx.consumer)
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
              <Link key={tx.id} href={`/transactions/${tx.id}`}>
                <TxRow
                  emoji={tx.category?.icon}
                  title={tx.description}
                  category={tx.category?.name}
                  paymentLabel={paymentMethodCaption(tx)}
                  dateLabel={formatDate(tx.transaction_date)}
                  amount={Number(tx.amount)}
                  type={isIncome ? "income" : isExpense ? "expense" : "other"}
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
                />
              </Link>
            );
          })
        )}
      </div>

      <TransactionFormDialog
        member={member}
        trigger={<Fab color={accent.color} />}
      />
    </div>
  );
}
