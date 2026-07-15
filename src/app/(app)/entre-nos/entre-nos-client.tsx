"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle,
  QrCode,
  Share2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspaceMembers } from "@/lib/hooks/use-finance";
import type { WorkspaceMember } from "@/types";
import {
  Avatar,
  Badge,
  Btn,
  Divider,
  EmptyState,
  MoneyDisplay,
  TopBar,
  toDsMember,
} from "@/components/design-system";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { computeEntreNosSettlement } from "@/lib/finance/entre-nos";

type SettlementTx = {
  id: string;
  amount: number;
  description: string;
  transaction_date: string;
  paid_by_member_id: string | null;
  category?: { icon?: string | null; name?: string | null } | null;
  cards?: { owner_member_id?: string } | null;
  accounts?: { owner_member_id?: string } | null;
};

/**
 * Entre Nós — tela de acertos (layout Figma Make).
 * Estimativa: quem pagou (paid_by) vs dono do cartão/conta.
 */
export function EntreNosClient({ member }: { member: WorkspaceMember }) {
  const [settled, setSettled] = useState(false);
  const { data: members = [] } = useWorkspaceMembers(member.workspace_id);

  const { data: txs = [], isLoading } = useQuery({
    queryKey: ["entre-nos", member.workspace_id],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("transactions")
        .select(
          `
          id, amount, description, transaction_type, paid_by_member_id,
          transaction_date, category:categories(icon, name),
          cards(owner_member_id), accounts(owner_member_id)
        `
        )
        .eq("workspace_id", member.workspace_id)
        .in("transaction_type", ["expense", "loan_given"])
        .neq("status", "cancelled")
        .order("transaction_date", { ascending: false })
        .limit(40);
      if (error) throw error;
      return (data ?? []) as SettlementTx[];
    },
  });

  const settlement = useMemo(() => {
    const raw = computeEntreNosSettlement(
      members.map((m) => ({ id: m.id, display_name: m.display_name })),
      txs
    );
    const debtor = raw.debtor
      ? {
          member: members.find((m) => m.id === raw.debtor!.id),
          net: raw.debtor.net,
        }
      : null;
    const creditor = raw.creditor
      ? {
          member: members.find((m) => m.id === raw.creditor!.id),
          net: raw.creditor.net,
        }
      : null;
    return {
      debtor,
      creditor,
      netAmount: raw.netAmount,
      aPaidForB: raw.aPaidForB,
      bPaidForA: raw.bPaidForA,
      timeline: raw.recent.map((item) => ({
        id: item.id,
        emoji:
          txs.find((t) => t.id === item.id)?.category?.icon ?? "💸",
        title: item.title,
        date: formatDate(item.date),
        amount: item.amount,
        consumerId: raw.debtor?.id ?? "",
        payerId: raw.creditor?.id ?? "",
      })),
    };
  }, [txs, members]);

  const subtitle =
    members.length >= 2
      ? members
          .slice(0, 2)
          .map((m) => m.display_name)
          .join(" & ")
      : member.workspace?.name ?? "Workspace";

  const hasDebt =
    !settled &&
    settlement.debtor &&
    settlement.creditor &&
    settlement.netAmount >= 1;

  return (
    <div className="flex flex-col pb-28 md:pb-8">
      <TopBar
        title="Entre Nós"
        subtitle={subtitle}
        className="md:px-6"
        rightEl={
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-chip)]"
            aria-label="Compartilhar"
          >
            <Share2 size={16} strokeWidth={2} className="text-[#8E8E93]" />
          </button>
        }
      />

      <div className="page-pad space-y-5 md:px-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Calculando acertos…</p>
        ) : settled ? (
          <div className="flex flex-col items-center gap-3 rounded-[10px] border-[0.5px] border-[#BBF7D0] bg-[#F0FDF4] py-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-[10px] bg-[#F0FDF4]">
              <CheckCircle size={24} className="text-[#22C55E]" />
            </div>
            <div className="text-center">
              <p className="font-medium text-[#22C55E]">Acerto registrado!</p>
              <p className="mt-1 text-xs text-[#8E8E93]">
                Saldo zerado entre{" "}
                {settlement.debtor?.member?.display_name ?? "vocês"}.
              </p>
            </div>
            <Btn
              variant="ghost"
              size="sm"
              onClick={() => setSettled(false)}
            >
              Desfazer
            </Btn>
          </div>
        ) : !hasDebt ? (
          <EmptyState
            title="Tudo certo entre vocês"
            description="Não há saldo líquido relevante entre membros com base em quem pagou vs dono do cartão/conta."
          />
        ) : (
          <>
            {/* Hero */}
            <div className="relative overflow-hidden rounded-xl border border-[#E5E5EA] bg-white p-6">
              <div className="relative z-10 mb-6 flex items-center justify-between">
                <div className="flex flex-col items-center gap-2">
                  <div className="relative">
                    <Avatar
                      member={toDsMember(settlement.debtor!.member!)}
                      size={56}
                    />
                    <div className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-[0.5px] border-white bg-[#EF4444]">
                      <ArrowUpRight
                        size={10}
                        strokeWidth={3}
                        className="text-[#111111]"
                      />
                    </div>
                  </div>
                  <p className="text-[13px] font-medium text-[#111111]">
                    {settlement.debtor!.member!.display_name}
                  </p>
                  <Badge label="Deve" color="#cc4444" bg="#cc444415" />
                </div>

                <div className="flex flex-1 flex-col items-center gap-2 px-4">
                  <div className="flex w-full items-center">
                    <div className="h-px flex-1 bg-[#E5E5EA]-hi" />
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-chip)]">
                      <ArrowRight
                        size={12}
                        strokeWidth={2.5}
                        className="text-[#8E8E93]"
                      />
                    </div>
                    <div className="h-px flex-1 bg-[#E5E5EA]-hi" />
                  </div>
                  <span className="text-[10px] font-medium text-[#3A3A3C]">
                    transferência sugerida
                  </span>
                </div>

                <div className="flex flex-col items-center gap-2">
                  <div className="relative">
                    <Avatar
                      member={toDsMember(settlement.creditor!.member!)}
                      size={56}
                    />
                    <div className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-[0.5px] border-white bg-[#22C55E]">
                      <ArrowDownLeft
                        size={10}
                        strokeWidth={3}
                        className="text-[#111111]"
                      />
                    </div>
                  </div>
                  <p className="text-[13px] font-medium text-[#111111]">
                    {settlement.creditor!.member!.display_name}
                  </p>
                  <Badge label="Recebe" color="#448844" bg="#44884415" />
                </div>
              </div>

              <div className="flex flex-col items-center gap-1.5 border-t border-[#E5E5EA] py-5">
                <p className="text-xs font-medium uppercase tracking-wider text-[#8E8E93]">
                  Saldo líquido
                </p>
                <MoneyDisplay
                  amount={settlement.netAmount}
                  size="xl"
                  color="#cc4444"
                />
                <p className="text-center text-sm text-[#8E8E93]">
                  <span className="font-medium text-[#111111]">
                    {settlement.debtor!.member!.display_name}
                  </span>{" "}
                  deve pagar para{" "}
                  <span className="font-medium text-[#111111]">
                    {settlement.creditor!.member!.display_name}
                  </span>
                </p>
              </div>
            </div>

            {/* Resumo */}
            <div className="overflow-hidden rounded-xl border border-[#E5E5EA] bg-white">
              <p className="px-4 pb-3 pt-4 text-[11px] font-medium uppercase tracking-wider text-[#8E8E93]">
                Resumo
              </p>
              <Divider />
              <div className="flex items-center justify-between px-4 py-3.5">
                <div className="flex items-center gap-2">
                  <span className="text-base">⬆️</span>
                  <p className="text-[13px] text-[#8E8E93]">
                    {settlement.creditor!.member!.display_name} pagou para{" "}
                    {settlement.debtor!.member!.display_name}
                  </p>
                </div>
                <span className="font-mono text-[14px] font-medium text-[#EF4444]">
                  {formatCurrency(settlement.bPaidForA)}
                </span>
              </div>
              <Divider />
              <div className="flex items-center justify-between px-4 py-3.5">
                <div className="flex items-center gap-2">
                  <span className="text-base">⬇️</span>
                  <p className="text-[13px] text-[#8E8E93]">
                    {settlement.debtor!.member!.display_name} pagou para{" "}
                    {settlement.creditor!.member!.display_name}
                  </p>
                </div>
                <span className="font-mono text-[14px] font-medium text-[#22C55E]">
                  {formatCurrency(settlement.aPaidForB)}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-[#E5E5EA] px-4 py-3.5">
                <p className="text-[13px] font-medium text-[#111111]">
                  Diferença
                </p>
                <span className="font-mono text-[15px] font-medium text-[#EF4444]">
                  {formatCurrency(settlement.netAmount)}
                </span>
              </div>
            </div>

            {/* Histórico */}
            {settlement.timeline.length > 0 && (
              <div>
                <p className="mb-3 text-[13px] font-medium uppercase tracking-wider text-[#8E8E93]">
                  Histórico
                </p>
                <div className="flex flex-col gap-0.5">
                  {settlement.timeline.map((item) => {
                    const consumer = members.find(
                      (m) => m.id === item.consumerId
                    );
                    const payer = members.find((m) => m.id === item.payerId);
                    if (!consumer || !payer) return null;
                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 py-3"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white text-base">
                          {item.emoji}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-medium text-[#111111]">
                            {item.title}
                          </p>
                          <div className="mt-0.5 flex items-center gap-1.5">
                            <div className="flex h-3 w-3 items-center justify-center rounded-full bg-[#1C1C1E] text-[7px] font-medium text-[#111111]">
                              {consumer.display_name[0]}
                            </div>
                            <span className="text-[11px] text-[#3A3A3C]">
                              consumiu
                            </span>
                            <span className="text-[#C7C7CC]">·</span>
                            <div className="flex h-3 w-3 items-center justify-center rounded-full bg-[#1C1C1E] text-[7px] font-medium text-[#111111]">
                              {payer.display_name[0]}
                            </div>
                            <span className="truncate text-[11px] text-[#3A3A3C]">
                              pagou · {item.date}
                            </span>
                          </div>
                        </div>
                        <span className="shrink-0 font-mono text-[14px] font-medium text-[#8E8E93]">
                          {formatCurrency(item.amount)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2 pt-1">
              <Btn
                variant="primary"
                size="lg"
                fullWidth
                wsColor="#c0c0c0"
                icon={<Check size={18} strokeWidth={2.5} />}
                onClick={() => setSettled(true)}
              >
                Registrar acerto
              </Btn>
              <Btn
                variant="secondary"
                size="md"
                fullWidth
                icon={<QrCode size={16} />}
                onClick={() => {
                  const text = `PIX: ${formatCurrency(settlement.netAmount)} de ${settlement.debtor!.member!.display_name} para ${settlement.creditor!.member!.display_name}`;
                  void navigator.clipboard?.writeText(text);
                }}
              >
                Gerar QR Code PIX
              </Btn>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
