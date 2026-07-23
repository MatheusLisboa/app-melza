"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { deleteTransactionAction } from "@/lib/actions/transactions";
import { invalidateFinanceQueries } from "@/lib/finance/invalidate";
import type { TransactionWithRelations, WorkspaceMember } from "@/types";
import {
  Avatar,
  Btn,
  Divider,
  DsSkeleton,
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
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
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
      toast.error(res.error);
      return;
    }
    toast.success("Lançamento excluído");
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
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="border-b border-[var(--color-fog)]">
          <DrawerTitle>Detalhe</DrawerTitle>
        </DrawerHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
          {isLoading ? (
            <div className="space-y-3">
              <DsSkeleton h="h-14" w="w-14" className="mx-auto rounded-full" />
              <DsSkeleton h="h-4" w="w-40" className="mx-auto" />
              <DsSkeleton h="h-8" w="w-28" className="mx-auto" />
              <DsSkeleton h="h-32" className="rounded-xl" />
            </div>
          ) : isError || !tx ? (
            <div>
              <p className="text-sm font-semibold text-[var(--color-ink)]">
                Lançamento não encontrado
              </p>
              <p className="mt-1 text-xs text-[var(--color-silver)]">
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
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-ink)] text-lg font-bold text-white">
                  {(
                    tx.description.trim().charAt(0) ||
                    tx.category?.name?.charAt(0) ||
                    "?"
                  ).toUpperCase()}
                </div>
                <div className="text-center">
                  <p className="text-base font-semibold text-[var(--color-ink)]">
                    {tx.description}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--color-silver)]">
                    {[tx.category?.name, formatDate(tx.transaction_date)]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <p
                  className={
                    isIncome
                      ? "font-mono text-[28px] font-extrabold text-[var(--color-income)]"
                      : isExpense
                        ? "font-mono text-[28px] font-extrabold text-[var(--color-expense)]"
                        : "font-mono text-[28px] font-extrabold text-[var(--color-ink)]"
                  }
                >
                  {isIncome ? "+" : isExpense ? "−" : ""}
                  {formatCurrency(Number(tx.amount))}
                </p>
              </div>

              {(consumer || payer || cardOwner) && (
                <div className="mb-4 overflow-hidden rounded-xl border border-[var(--color-fog)] bg-[var(--color-white)]">
                  <p className="px-4 pb-2 pt-3 text-[11px] font-medium uppercase tracking-wider text-[var(--color-silver)]">
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
                            <p className="text-sm font-semibold text-[var(--color-ink)]">
                              {row.m!.name}
                            </p>
                            <p className="text-xs text-[var(--color-silver)]">
                              {row.desc}
                            </p>
                          </div>
                          <span className="rounded-full bg-[var(--color-pearl)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-silver)]">
                            {row.label}
                          </span>
                        </div>
                        {i < arr.length - 1 && <Divider />}
                      </div>
                    ))}
                </div>
              )}

              <div className="overflow-hidden rounded-xl border border-[var(--color-fog)] bg-[var(--color-white)]">
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
                      <p className="text-sm text-[var(--color-silver)]">
                        {row.label}
                      </p>
                      <p className="text-sm font-semibold text-[var(--color-ink)]">
                        {row.value}
                      </p>
                    </div>
                    {i < arr.length - 1 && <Divider />}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {tx && !isLoading ? (
          <DrawerFooter>
            <Btn
              variant="destructive"
              size="md"
              fullWidth
              disabled={busy || tx.status === "cancelled"}
              onClick={onDelete}
            >
              Excluir lançamento
            </Btn>
          </DrawerFooter>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}
