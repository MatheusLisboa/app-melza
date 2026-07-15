"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { deleteTransactionAction } from "@/lib/actions/transactions";
import { invalidateFinanceQueries } from "@/lib/finance/invalidate";
import type { TransactionWithRelations, WorkspaceMember } from "@/types";
import {
  Avatar,
  Btn,
  Divider,
  toDsMember,
} from "@/components/design-system";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { getBankName } from "@/lib/utils/banks";
import {
  paymentChannelFromTags,
  paymentChannelLabel,
} from "@/lib/utils/payment-channel";
import { useWorkspaceMembers } from "@/lib/hooks/use-finance";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState } from "react";

export function TransactionDetailSheet({
  open,
  onOpenChange,
  member,
  transactionId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: WorkspaceMember;
  transactionId: string | null;
}) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const { data: members = [] } = useWorkspaceMembers(member.workspace_id);

  const {
    data: tx,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["transaction", transactionId],
    enabled: Boolean(open && transactionId),
    queryFn: async () => {
      const supabase = createClient();
      const { data, error: qError } = await supabase
        .from("transactions")
        .select(
          `
          *,
          category:categories(id, name, icon, color),
          card:cards(id, name, owner_member_id, bank)
        `
        )
        .eq("id", transactionId!)
        .eq("workspace_id", member.workspace_id)
        .maybeSingle();
      if (qError) throw new Error(qError.message);
      return data as TransactionWithRelations | null;
    },
  });

  async function onDelete() {
    if (!transactionId || !confirm("Excluir este lançamento?")) return;
    setBusy(true);
    const res = await deleteTransactionAction(transactionId);
    setBusy(false);
    if (res.error) {
      alert(res.error);
      return;
    }
    invalidateFinanceQueries(qc);
    onOpenChange(false);
  }

  const isIncome =
    tx?.transaction_type === "income" ||
    tx?.transaction_type === "loan_received";
  const isExpense =
    tx?.transaction_type === "expense" ||
    tx?.transaction_type === "loan_given";

  const payer = tx?.paid_by ? toDsMember(tx.paid_by) : null;
  const consumer = tx?.consumer ? toDsMember(tx.consumer) : payer;
  const cardOwnerMember = members.find(
    (m) => m.id === tx?.card?.owner_member_id
  );
  const cardOwner = cardOwnerMember ? toDsMember(cardOwnerMember) : payer;

  const channel = paymentChannelFromTags(tx?.tags);
  const channelLabel = paymentChannelLabel(channel);
  const instrumentName = tx?.card?.name ?? tx?.account?.name ?? null;
  const meioLabel = channelLabel
    ? instrumentName
      ? `${channelLabel} · ${instrumentName}`
      : channelLabel
    : instrumentName ?? "—";

  const statusLabel =
    tx?.status === "confirmed"
      ? "Concluída"
      : tx?.status === "scheduled"
        ? "Agendada"
        : tx?.status === "cancelled"
          ? "Cancelada"
          : (tx?.status ?? "—");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-[20px] border border-[var(--color-line)] bg-[var(--color-modal)] p-0 shadow-modal sm:rounded-[20px]">
        <DialogHeader className="border-b border-[var(--color-line)] px-5 py-4 text-left">
          <DialogTitle className="text-[17px] font-bold text-[var(--color-text)]">
            Detalhe
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 py-5">
          {isLoading ? (
            <p className="text-sm text-[var(--color-text-2)]">Carregando…</p>
          ) : isError || !tx ? (
            <div>
              <p className="text-sm font-semibold text-[var(--color-text)]">
                Lançamento não encontrado
              </p>
              <p className="mt-1 text-xs text-[var(--color-text-2)]">
                {isError
                  ? error instanceof Error
                    ? error.message
                    : "Falha ao carregar"
                  : "Pode ter sido excluído."}
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center gap-3 pb-5">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-icon)] text-lg font-bold text-white">
                  {(
                    tx.description.trim().charAt(0) ||
                    tx.category?.name?.charAt(0) ||
                    "?"
                  ).toUpperCase()}
                </div>
                <div className="text-center">
                  <p className="text-base font-semibold text-[var(--color-text)]">
                    {tx.description}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--color-text-2)]">
                    {[tx.category?.name, formatDate(tx.transaction_date)]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <p
                  className={
                    isIncome
                      ? "font-mono text-[28px] font-extrabold text-[#22C55E]"
                      : isExpense
                        ? "font-mono text-[28px] font-extrabold text-[#EF4444]"
                        : "font-mono text-[28px] font-extrabold text-[var(--color-text)]"
                  }
                >
                  {isIncome ? "+" : isExpense ? "−" : ""}
                  {formatCurrency(Number(tx.amount))}
                </p>
              </div>

              {(consumer || payer || cardOwner) && (
                <div className="mb-4 overflow-hidden rounded-[14px] border border-[var(--color-line)] bg-[var(--color-card)]">
                  <p className="px-4 pb-2 pt-3 text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-2)]">
                    Atribuição
                  </p>
                  <Divider />
                  {[
                    {
                      label: "Consumiu",
                      m: consumer,
                      desc: "Beneficiário",
                    },
                    { label: "Pagou", m: payer, desc: "Quem desembolsou" },
                    {
                      label: "Cartão",
                      m: cardOwner,
                      desc: tx.card
                        ? `${tx.card.name}${tx.card.bank ? ` · ${getBankName(tx.card.bank)}` : ""}`
                        : "—",
                    },
                  ]
                    .filter((row) => row.m)
                    .map((row, i, arr) => (
                      <div key={row.label}>
                        <div className="flex items-center gap-3 px-4 py-3">
                          <Avatar member={row.m!} size={36} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-[var(--color-text)]">
                              {row.m!.name}
                            </p>
                            <p className="text-xs text-[var(--color-text-2)]">
                              {row.desc}
                            </p>
                          </div>
                          <span className="rounded-full bg-[var(--color-chip)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-text-2)]">
                            {row.label}
                          </span>
                        </div>
                        {i < arr.length - 1 && <Divider />}
                      </div>
                    ))}
                </div>
              )}

              <div className="overflow-hidden rounded-[14px] border border-[var(--color-line)] bg-[var(--color-card)]">
                {[
                  { label: "Data", value: formatDate(tx.transaction_date) },
                  { label: "Categoria", value: tx.category?.name ?? "—" },
                  { label: "Status", value: statusLabel },
                  { label: "Meio", value: meioLabel },
                  {
                    label: "Parcela",
                    value:
                      tx.is_installment &&
                      tx.installment_number &&
                      tx.total_installments
                        ? `${tx.installment_number}/${tx.total_installments}`
                        : "—",
                  },
                ].map((row, i, arr) => (
                  <div key={row.label}>
                    <div className="flex items-center justify-between px-4 py-3">
                      <p className="text-sm text-[var(--color-text-2)]">
                        {row.label}
                      </p>
                      <p className="text-sm font-semibold text-[var(--color-text)]">
                        {row.value}
                      </p>
                    </div>
                    {i < arr.length - 1 && <Divider />}
                  </div>
                ))}
              </div>

              <div className="mt-4">
                <Btn
                  variant="destructive"
                  size="md"
                  fullWidth
                  disabled={busy || tx.status === "cancelled"}
                  onClick={onDelete}
                >
                  Excluir lançamento
                </Btn>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
