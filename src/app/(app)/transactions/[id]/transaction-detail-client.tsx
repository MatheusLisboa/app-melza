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

  const { data: tx, isLoading } = useQuery({
    queryKey: ["transaction", transactionId],
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
        .eq("id", transactionId)
        .eq("workspace_id", member.workspace_id)
        .single();
      if (error) throw error;
      return data as TransactionWithRelations;
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

  if (isLoading || !tx) {
    return (
      <div className="page-pad">
        <TopBar title="Detalhes" onBack={() => router.back()} />
        <p className="mt-8 text-sm text-muted-foreground">Carregando…</p>
      </div>
    );
  }

  const payer = tx.paid_by
    ? toDsMember(tx.paid_by)
    : null;
  const consumer = tx.consumer
    ? toDsMember(tx.consumer)
    : payer;
  const cardOwnerMember = members.find(
    (m) => m.id === tx.card?.owner_member_id
  );
  const cardOwner = cardOwnerMember
    ? toDsMember(cardOwnerMember)
    : payer;

  const isIncome =
    tx.transaction_type === "income" ||
    tx.transaction_type === "loan_received";

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
  const instrumentName = tx.card?.name ?? tx.account?.name ?? null;
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
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1C1C1F] text-4xl">
            {tx.category?.icon || "💸"}
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-white/90">
              {tx.description}
            </p>
            <p className="mt-0.5 text-sm text-white/35">
              {[tx.category?.name, formatDate(tx.transaction_date)]
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
          <div className="mb-4 overflow-hidden rounded-2xl border border-white/[0.06] bg-[#111113]">
            <p className="px-4 pb-3 pt-4 text-[11px] font-semibold uppercase tracking-wider text-white/35">
              Atribuição
            </p>
            <Divider />
            {[
              {
                label: "Quem consumiu",
                m: consumer,
                desc: "Beneficiário da despesa",
              },
              {
                label: "Quem pagou",
                m: payer,
                desc: "Desembolsou o dinheiro",
              },
              {
                label: "Dono do cartão",
                m: cardOwner,
                desc: tx.card
                  ? `${tx.card.name}${tx.card.bank ? ` · ${getBankName(tx.card.bank)}` : ""}`
                  : "Cartão utilizado",
              },
            ]
              .filter((row) => row.m)
              .map((row, i, arr) => (
                <div key={row.label}>
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    <Avatar member={row.m!} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-semibold text-white/90">
                        {row.m!.name}
                      </p>
                      <p className="mt-0.5 text-xs text-white/35">{row.desc}</p>
                    </div>
                    <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs font-medium text-white/40">
                      {row.label}
                    </span>
                  </div>
                  {i < arr.length - 1 && <Divider />}
                </div>
              ))}
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#111113]">
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
                <p className="text-sm text-white/40">{row.label}</p>
                <p className="text-sm font-medium text-white/80">{row.value}</p>
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
