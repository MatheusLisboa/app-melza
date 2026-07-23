"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Copy, Eye, FileText, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  useCardMutations,
  useWorkspaceMembers,
} from "@/lib/hooks/use-finance";
import type {
  Card,
  TransactionWithRelations,
  WorkspaceMember,
} from "@/types";
import {
  Divider,
  DsSkeleton,
  TopBar,
  TxRow,
  toDsMember,
} from "@/components/design-system";
import { CardFormDialog } from "@/components/cards/card-form-dialog";
import { TransactionDetailSheet } from "@/components/transactions/transaction-detail-sheet";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import {
  cardAvailableLimit,
  getCurrentInvoiceCycle,
  sumCardCommittedLimit,
} from "@/lib/finance/card-cycle";
import { getBankName } from "@/lib/utils/banks";
import { cn } from "@/lib/utils";

export function CardDetailClient({
  member,
  cardId,
}: {
  member: WorkspaceMember;
  cardId: string;
}) {
  const router = useRouter();
  const { data: members = [] } = useWorkspaceMembers(member.workspace_id);
  const cardMutations = useCardMutations(member.workspace_id);
  const [showNumber, setShowNumber] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data: card, isLoading } = useQuery({
    queryKey: ["card", cardId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("cards")
        .select("*")
        .eq("id", cardId)
        .eq("workspace_id", member.workspace_id)
        .single();
      if (error) throw new Error(error.message);
      return data as Card;
    },
  });

  const cycle = useMemo(() => {
    if (!card) return null;
    return getCurrentInvoiceCycle(card);
  }, [card]);

  const { data: recent = [] } = useQuery({
    queryKey: ["card-recent", cardId, member.workspace_id],
    enabled: Boolean(card),
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("transactions")
        .select(
          `
          *,
          category:categories(id, name, icon, color),
          card:cards(id, name, owner_member_id, bank)
        `
        )
        .eq("workspace_id", member.workspace_id)
        .eq("card_id", cardId)
        .neq("status", "cancelled")
        .order("transaction_date", { ascending: false })
        .limit(8);
      if (error) throw new Error(error.message);
      return data as TransactionWithRelations[];
    },
  });

  const { data: cycleTx = [] } = useQuery({
    queryKey: [
      "card-cycle",
      cardId,
      member.workspace_id,
      cycle?.from,
      cycle?.to,
    ],
    enabled: Boolean(card && cycle),
    staleTime: 30_000,
    queryFn: async () => {
      const supabase = createClient();
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
        .eq("card_id", cardId)
        .neq("status", "cancelled")
        .or(
          `status.eq.scheduled,and(transaction_date.gte.${cycle!.from},transaction_date.lte.${cycle!.to})`
        );
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const { cycleSpend, futureCommitted, committed } = useMemo(() => {
    if (!cycle) {
      return { cycleSpend: 0, futureCommitted: 0, committed: 0 };
    }
    return sumCardCommittedLimit(cycleTx, cycle);
  }, [cycle, cycleTx]);

  if (isLoading || !card) {
    return (
      <div className="page-pad">
        <TopBar title="Cartão" onBack={() => router.back()} />
        <div className="mt-6 space-y-3">
          <DsSkeleton h="h-36" className="rounded-2xl" />
          <DsSkeleton h="h-20" className="rounded-xl" />
          <DsSkeleton h="h-40" className="rounded-xl" />
        </div>
      </div>
    );
  }

  const owner = members.find((m) => m.id === card.owner_member_id);
  const limit = card.credit_limit != null ? Number(card.credit_limit) : null;
  const available = cardAvailableLimit(limit, committed);
  const usedPct =
    limit != null && limit > 0
      ? Math.min(100, Math.round((committed / limit) * 100))
      : null;

  const typeLabel = card.card_type === "debit" ? "Débito" : "Crédito";

  return (
    <div className="pb-8">
      <TopBar
        title={card.name}
        subtitle={getBankName(card.bank)}
        onBack={() => router.back()}
        rightEl={
          <CardFormDialog
            members={members}
            initial={card}
            trigger={
              <button
                type="button"
                className="touch-target flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-pearl)] text-[var(--color-silver)] transition-colors hover:text-[var(--color-ink)]"
                aria-label="Editar cartão"
              >
                <Pencil size={16} />
              </button>
            }
            onSubmit={async (values) => {
              await cardMutations.update.mutateAsync({
                id: card.id,
                ...values,
              });
            }}
          />
        }
      />

      <div className="px-5 md:px-6">
        <div className="relative mx-auto mt-2 w-full max-w-[340px] overflow-hidden rounded-2xl bg-[var(--color-ink)] p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--color-mist)]">
                {getBankName(card.bank)} · {typeLabel}
              </p>
              <p className="mt-1 truncate text-[17px] font-semibold text-white">
                {card.name}
              </p>
            </div>
            {owner && (
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-[11px] font-semibold text-white"
                title={owner.display_name}
              >
                {owner.display_name[0]}
              </div>
            )}
          </div>

          <div className="mt-8 flex items-end justify-between gap-2">
            <div>
              <p className="font-mono text-[15px] font-medium tracking-[0.16em] text-white">
                {showNumber
                  ? `•••• ${card.last_four ?? "····"}`
                  : "•••• ••••"}
              </p>
            </div>
            {limit != null && (
              <div className="text-right">
                <p className="text-[9px] uppercase tracking-wider text-[var(--color-mist)]">
                  Limite
                </p>
                <p className="font-mono text-[13px] font-medium text-white">
                  {formatCurrency(limit)}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="mx-auto mt-3 grid max-w-[300px] grid-cols-3 gap-2">
          {[
            {
              icon: Eye,
              label: showNumber ? "Ocultar" : "Ver final",
              onClick: () => setShowNumber((v) => !v),
            },
            {
              icon: Copy,
              label: "Copiar",
              onClick: () => {
                void navigator.clipboard?.writeText(
                  card.last_four ?? card.name
                );
              },
            },
            {
              icon: FileText,
              label: "Fatura",
              onClick: () => router.push("/invoices"),
            },
          ].map(({ icon: Icon, label, onClick }) => (
            <button
              key={label}
              type="button"
              onClick={onClick}
              className="flex flex-col items-center gap-1 rounded-[12px] border border-[var(--color-line)] bg-[var(--color-card)] py-2.5 transition-colors hover:bg-[var(--color-chip)]"
            >
              <Icon
                size={16}
                strokeWidth={1.75}
                className="text-[var(--color-text-2)]"
              />
              <span className="text-[10px] font-medium text-[var(--color-text-2)]">
                {label}
              </span>
            </button>
          ))}
        </div>

        {/* Limit usage */}
        {usedPct != null && (
          <div className="mt-4 rounded-[14px] border border-[var(--color-line)] bg-[var(--color-card)] p-4">
            <div className="mb-2 flex items-end justify-between gap-2">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-2)]">
                  Limite comprometido
                </p>
                <p className="mt-0.5 font-mono text-[20px] font-semibold text-[var(--color-text)]">
                  {usedPct}%
                </p>
              </div>
              <p className="text-right text-[11px] text-[var(--color-text-2)]">
                Disponível
                <br />
                <span className="font-mono text-[13px] font-medium text-[var(--color-text)]">
                  {available != null ? formatCurrency(available) : "—"}
                </span>
              </p>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[var(--color-pearl)]">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  usedPct >= 90
                    ? "bg-[var(--color-expense)]"
                    : "bg-[var(--color-ink)]"
                )}
                style={{ width: `${usedPct}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-[var(--color-text-3)]">
              Ciclo {formatCurrency(cycleSpend)}
              {futureCommitted > 0
                ? ` · parcelas ${formatCurrency(futureCommitted)}`
                : ""}
            </p>
          </div>
        )}

        {/* Details list */}
        <div className="mt-3 overflow-hidden rounded-[14px] border border-[var(--color-line)] bg-[var(--color-card)]">
          {[
            {
              label: "Limite total",
              value: limit != null ? formatCurrency(limit) : "—",
            },
            {
              label: "Neste ciclo",
              value: formatCurrency(cycleSpend),
            },
            {
              label: "Parcelas a vencer",
              value:
                futureCommitted > 0 ? formatCurrency(futureCommitted) : "—",
            },
            {
              label: "Fechamento",
              value: card.closing_day ? `Dia ${card.closing_day}` : "—",
            },
            {
              label: "Vencimento",
              value: card.due_day ? `Dia ${card.due_day}` : "—",
            },
            {
              label: "Titular",
              value: owner?.display_name ?? "—",
            },
            {
              label: "Status",
              value: card.is_active ? "Ativo" : "Inativo",
            },
          ].map((row, i, arr) => (
            <div key={row.label}>
              <div className="flex items-center justify-between px-4 py-3">
                <p className="text-sm text-[var(--color-text-2)]">{row.label}</p>
                <p className="font-mono text-sm font-medium text-[var(--color-text)]">
                  {row.value}
                </p>
              </div>
              {i < arr.length - 1 && <Divider />}
            </div>
          ))}
        </div>
        <p className="mt-1.5 px-1 text-[11px] text-[var(--color-text-3)]">
          Disponível = limite − ciclo atual − parcelas futuras.
        </p>

        <h3 className="mb-2 mt-5 text-[13px] font-medium uppercase tracking-wider text-[var(--color-text-2)]">
          Transações recentes
        </h3>
        {recent.length === 0 ? (
          <p className="text-sm text-[var(--color-text-2)]">
            Nenhum lançamento neste cartão.
          </p>
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
              const cardOwner = owner ? toDsMember(owner) : payer;
              const isIncome =
                tx.transaction_type === "income" ||
                tx.transaction_type === "loan_received";
              return (
                <div key={tx.id}>
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => setDetailId(tx.id)}
                  >
                    <TxRow
                      emoji={tx.category?.icon}
                      title={tx.description}
                      category={tx.category?.name}
                      dateLabel={formatDate(tx.transaction_date)}
                      amount={Number(tx.amount)}
                      type={isIncome ? "income" : "expense"}
                      pending={tx.status === "scheduled"}
                      consumer={consumer}
                      payer={payer}
                      cardOwner={cardOwner}
                    />
                  </button>
                  {i < recent.length - 1 && <Divider />}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <TransactionDetailSheet
        open={Boolean(detailId)}
        onOpenChange={(open) => {
          if (!open) setDetailId(null);
        }}
        transactionId={detailId}
        member={member}
      />
    </div>
  );
}
