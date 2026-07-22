"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useWorkspaceMembers } from "@/lib/hooks/use-finance";
import { deleteTransactionAction } from "@/lib/actions/transactions";
import { invalidateFinanceQueries } from "@/lib/finance/invalidate";
import type { TransactionWithRelations, WorkspaceMember } from "@/types";
import {
  Avatar,
  Btn,
  Divider,
  MoneyDisplay,
  TopBar,
  toDsMember,
} from "@/components/design-system";
import { formatDate } from "@/lib/utils/format";
import { getBankName } from "@/lib/utils/banks";
import {
  paymentChannelFromTags,
  paymentChannelLabel,
} from "@/lib/utils/payment-channel";

export function TransactionDetailClient({
  member,
  transactionId,
}: {
  member: WorkspaceMember;
  transactionId: string;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const { data: members = [] } = useWorkspaceMembers(member.workspace_id);

  const {
    data: tx,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["transaction", transactionId],
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
        .eq("id", transactionId)
        .eq("workspace_id", member.workspace_id)
        .maybeSingle();
      if (qError) throw new Error(qError.message);
      return data as TransactionWithRelations | null;
    },
  });

  async function onDelete() {
    if (!confirm("Excluir este lançamento?")) return;
    setBusy(true);
    const res = await deleteTransactionAction(transactionId);
    setBusy(false);
    if (res.error) {
      alert(res.error);
      return;
    }
    invalidateFinanceQueries(qc);
    router.push("/transactions");
  }

  if (isLoading) {
    return (
      <div className="page-pad">
        <TopBar title="Detalhes" onBack={() => router.back()} />
        <p className="mt-8 text-sm text-[var(--color-text-2)]">Carregando…</p>
      </div>
    );
  }

  if (isError || !tx) {
    return (
      <div className="page-pad">
        <TopBar title="Detalhes" onBack={() => router.back()} />
        <div className="mt-8 rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] p-4">
          <p className="text-sm text-[var(--color-text)]">
            Lançamento não encontrado
          </p>
          <p className="mt-1 text-xs text-[var(--color-text-2)]">
            {isError
              ? error instanceof Error
                ? error.message
                : "Falha ao carregar"
              : "Pode ter sido excluído ou está em outro workspace."}
          </p>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              className="text-sm text-[var(--color-text)] underline"
              onClick={() => void refetch()}
            >
              Tentar de novo
            </button>
            <button
              type="button"
              className="text-sm text-[var(--color-text-2)] underline"
              onClick={() => router.push("/transactions")}
            >
              Voltar ao histórico
            </button>
          </div>
        </div>
      </div>
    );
  }
  const payerMember = members.find((m) => m.id === tx.paid_by_member_id);
  const consumerMember = members.find((m) => m.id === tx.consumer_member_id);
  const payer = payerMember ? toDsMember(payerMember) : null;
  const consumer = consumerMember ? toDsMember(consumerMember) : payer;
  const cardOwnerMember = members.find(
    (m) => m.id === tx.card?.owner_member_id
  );
  const cardOwner = cardOwnerMember
    ? toDsMember(cardOwnerMember)
    : payer;

  const isIncome =
    tx.transaction_type === "income" ||
    tx.transaction_type === "loan_received";
  const isSettlement = tx.transaction_type === "settlement";

  const statusLabel =
    tx.status === "confirmed"
      ? "Concluída"
      : tx.status === "scheduled"
        ? "Agendada"
        : tx.status === "cancelled"
          ? "Cancelada"
          : tx.status;

  const channel = paymentChannelFromTags(tx.tags);
  const channelLabel = paymentChannelLabel(channel);
  const instrumentName = tx.card?.name ?? null;
  const meioLabel = channelLabel
    ? instrumentName
      ? `${channelLabel} · ${instrumentName}`
      : channelLabel
    : instrumentName ?? "—";

  return (
    <div className="pb-8">
      <TopBar title="Detalhes" onBack={() => router.back()} />

      <div className="px-5">
        <div className="flex flex-col items-center gap-3 py-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-[10px] bg-[var(--color-chip)] text-4xl">
            {isSettlement ? "🤝" : tx.category?.icon || "💸"}
          </div>
          <div className="text-center">
            <p className="text-lg font-medium text-[var(--color-text)]">
              {tx.description}
            </p>
            <p className="mt-0.5 text-sm text-[var(--color-text-2)]">
              {[
                isSettlement ? "Acerto Entre Nós" : tx.category?.name,
                formatDate(tx.transaction_date),
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <MoneyDisplay
            amount={Number(tx.amount)}
            size="xl"
            color={isIncome ? "#22C55E" : undefined}
          />
        </div>

        {(consumer || payer || cardOwner) && (
          <div className="mb-4 overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-card)]">
            <p className="px-4 pb-3 pt-4 text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-2)]">
              {isSettlement ? "Acerto" : "Atribuição"}
            </p>
            <Divider />
            {[
              {
                label: isSettlement ? "Quem recebeu" : "Quem consumiu",
                m: consumer,
                desc: isSettlement
                  ? "Recebeu o reembolso"
                  : "Beneficiário da despesa",
              },
              {
                label: isSettlement ? "Quem pagou o acerto" : "Quem pagou",
                m: payer,
                desc: isSettlement
                  ? "Quitou (parcial ou total) a dívida"
                  : "Desembolsou o dinheiro",
              },
              ...(isSettlement
                ? []
                : [
                    {
                      label: "Dono do cartão",
                      m: cardOwner,
                      desc: tx.card
                        ? `${tx.card.name}${tx.card.bank ? ` · ${getBankName(tx.card.bank)}` : ""}`
                        : "Cartão utilizado",
                    },
                  ]),
            ]
              .filter((row) => row.m)
              .map((row, i, arr) => (
                <div key={row.label}>
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    <Avatar member={row.m!} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-medium text-[var(--color-text)]">
                        {row.m!.name}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--color-text-2)]">
                        {row.desc}
                      </p>
                    </div>
                    <span className="rounded-full bg-[var(--color-chip)] px-2 py-0.5 text-xs font-medium text-[var(--color-text-2)]">
                      {row.label}
                    </span>
                  </div>
                  {i < arr.length - 1 && <Divider />}
                </div>
              ))}
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-card)]">
          {[
            { label: "Data", value: formatDate(tx.transaction_date) },
            { label: "Categoria", value: tx.category?.name ?? "—" },
            { label: "Status", value: statusLabel },
            {
              label: "Meio",
              value: meioLabel,
            },
            {
              label: "Workspace",
              value: member.workspace?.name ?? "—",
            },
          ].map((row, i, arr) => (
            <div key={row.label}>
              <div className="flex items-center justify-between px-4 py-3.5">
                <p className="text-sm text-[var(--color-text-2)]">{row.label}</p>
                <p className="text-sm font-medium text-[var(--color-text)]">
                  {row.value}
                </p>
              </div>
              {i < arr.length - 1 && <Divider />}
            </div>
          ))}
        </div>

        <div className="mt-4 flex gap-2">
          <Btn
            variant="destructive"
            size="md"
            fullWidth
            disabled={busy || tx.status === "cancelled"}
            onClick={onDelete}
          >
            Excluir
          </Btn>
        </div>
      </div>
    </div>
  );
}
