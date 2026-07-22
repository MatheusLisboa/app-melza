"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  CreditCard,
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
import { SettleEntreNosDialog } from "@/components/entre-nos/settle-dialog";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import {
  computeEntreNosSettlement,
  type EntreNosTx,
} from "@/lib/finance/entre-nos";

/**
 * Entre Nós — acertos entre membros (consumiu vs pagou + settlements).
 */
export function EntreNosClient({ member }: { member: WorkspaceMember }) {
  const [showDebtDetail, setShowDebtDetail] = useState(false);
  const [settleOpen, setSettleOpen] = useState(false);
  const { data: members = [] } = useWorkspaceMembers(member.workspace_id);

  const {
    data: txs = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["entre-nos", member.workspace_id],
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const supabase = createClient();
      // accounts!account_id — há 2 FKs (account_id / transfer_to_account_id)
      const { data, error: qError } = await supabase
        .from("transactions")
        .select(
          `
          id, amount, description, transaction_type, paid_by_member_id,
          consumer_member_id, transaction_date,
          category:categories(icon, name),
          card:cards!card_id(id, name, owner_member_id),
          account:accounts!account_id(id, name, owner_member_id)
        `
        )
        .eq("workspace_id", member.workspace_id)
        .in("transaction_type", ["expense", "loan_given", "settlement"])
        .neq("status", "cancelled")
        .order("transaction_date", { ascending: false })
        .limit(300);
      if (qError) throw new Error(qError.message);
      return (data ?? []) as EntreNosTx[];
    },
  });

  const settlement = useMemo(() => {
    const raw = computeEntreNosSettlement(
      members.map((m) => ({ id: m.id, display_name: m.display_name })),
      txs
    );
    const debtor = raw.debtor
      ? {
          member: members.find((m) => m.id === raw.debtor!.id) ?? null,
          net: raw.debtor.net,
        }
      : null;
    const creditor = raw.creditor
      ? {
          member: members.find((m) => m.id === raw.creditor!.id) ?? null,
          net: raw.creditor.net,
        }
      : null;

    const debtTxs =
      raw.debtor && raw.creditor
        ? raw.recent.filter(
            (item) =>
              (item.consumerId === raw.debtor!.id &&
                item.payerId === raw.creditor!.id) ||
              (item.consumerId === raw.creditor!.id &&
                item.payerId === raw.debtor!.id)
          )
        : raw.recent;

    return {
      debtor,
      creditor,
      netAmount: raw.netAmount,
      aPaidForB: raw.aPaidForB,
      bPaidForA: raw.bPaidForA,
      settledAmount: raw.settledAmount,
      debtTxs,
      preview: debtTxs.filter((t) => !t.isSettlement).slice(0, 8),
      settlementTxs: debtTxs.filter((t) => t.isSettlement),
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
    settlement.debtor?.member &&
    settlement.creditor?.member &&
    settlement.netAmount >= 1;

  const cardPurchases = settlement.debtTxs.filter(
    (t) => t.cardName && !t.isSettlement
  );

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
        ) : isError ? (
          <EmptyState
            title="Não foi possível carregar"
            description={
              error instanceof Error
                ? error.message
                : "Tente de novo em instantes."
            }
            actionLabel="Tentar de novo"
            onAction={() => void refetch()}
          />
        ) : members.length < 2 ? (
          <EmptyState
            title="Aguardando membros"
            description="Convide alguém para o workspace. Quando entrarem, o acerto aparece aqui."
          />
        ) : !hasDebt ? (
          <EmptyState
            title="Tudo certo entre vocês"
            description={
              settlement.settledAmount > 0
                ? `Últimos acertos cobriram o saldo (${formatCurrency(settlement.settledAmount)} registrados).`
                : "Não há saldo líquido: quem consumiu e quem pagou estão quites (incluindo compras no cartão)."
            }
          />
        ) : (
          <>
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
                        className="text-white"
                      />
                    </div>
                  </div>
                  <p className="text-[13px] font-medium text-[#111111]">
                    {settlement.debtor!.member!.display_name}
                  </p>
                  <Badge label="Deve" color="#EF4444" bg="#EF444415" />
                </div>

                <div className="flex flex-1 flex-col items-center gap-2 px-4">
                  <div className="flex w-full items-center">
                    <div className="h-px flex-1 bg-[#E5E5EA]" />
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-chip)]">
                      <ArrowRight
                        size={12}
                        strokeWidth={2.5}
                        className="text-[#8E8E93]"
                      />
                    </div>
                    <div className="h-px flex-1 bg-[#E5E5EA]" />
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
                        className="text-white"
                      />
                    </div>
                  </div>
                  <p className="text-[13px] font-medium text-[#111111]">
                    {settlement.creditor!.member!.display_name}
                  </p>
                  <Badge label="Recebe" color="#22C55E" bg="#22C55E15" />
                </div>
              </div>

              <div className="flex flex-col items-center gap-1.5 border-t border-[#E5E5EA] py-5">
                <p className="text-xs font-medium uppercase tracking-wider text-[#8E8E93]">
                  Saldo líquido
                </p>
                <MoneyDisplay
                  amount={settlement.netAmount}
                  size="xl"
                  color="#EF4444"
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

            <button
              type="button"
              onClick={() => setShowDebtDetail((v) => !v)}
              className="flex w-full items-center justify-between rounded-xl border border-[#E5E5EA] bg-white px-4 py-3.5 text-left"
            >
              <div>
                <p className="text-[14px] font-medium text-[#111111]">
                  Ver detalhes do débito
                </p>
                <p className="mt-0.5 text-[12px] text-[#8E8E93]">
                  {settlement.debtTxs.length} lançamento
                  {settlement.debtTxs.length === 1 ? "" : "s"}
                  {cardPurchases.length > 0
                    ? ` · ${cardPurchases.length} no cartão`
                    : ""}
                  {settlement.settlementTxs.length > 0
                    ? ` · ${settlement.settlementTxs.length} acerto(s)`
                    : ""}
                </p>
              </div>
              {showDebtDetail ? (
                <ChevronDown size={18} className="text-[#8E8E93]" />
              ) : (
                <ChevronRight size={18} className="text-[#8E8E93]" />
              )}
            </button>

            {showDebtDetail && (
              <div className="overflow-hidden rounded-xl border border-[#E5E5EA] bg-white">
                <p className="px-4 pb-2 pt-4 text-[11px] font-medium uppercase tracking-wider text-[#8E8E93]">
                  Lançamentos que formam o saldo
                </p>
                <Divider />
                <div className="divide-y divide-[#E5E5EA]">
                  {settlement.debtTxs.map((item) => {
                    const towardCreditor =
                      item.consumerId === settlement.debtor?.member?.id &&
                      item.payerId === settlement.creditor?.member?.id;
                    return (
                      <Link
                        key={item.id}
                        href={`/transactions/${item.id}`}
                        className="flex items-center gap-3 px-4 py-3.5 transition-colors active:bg-[#F2F2F7]"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#F2F2F7] text-base">
                          {item.isSettlement
                            ? "🤝"
                            : (item.categoryIcon ?? "💸")}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-medium text-[#111111]">
                            {item.isSettlement ? "Acerto registrado" : item.title}
                          </p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                            {item.isSettlement ? (
                              <span className="text-[11px] text-[#3A3A3C]">
                                {item.payerName} pagou {item.consumerName}
                              </span>
                            ) : (
                              <span className="text-[11px] text-[#3A3A3C]">
                                {item.consumerName} consumiu · {item.payerName}{" "}
                                pagou
                              </span>
                            )}
                            {item.cardName ? (
                              <span className="inline-flex items-center gap-1 text-[11px] text-[#8E8E93]">
                                <CreditCard size={10} strokeWidth={2} />
                                {item.cardName}
                              </span>
                            ) : null}
                            <span className="text-[11px] text-[#C7C7CC]">
                              · {formatDate(item.date)}
                            </span>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-0.5">
                          <span
                            className={`font-mono text-[14px] font-medium ${
                              item.isSettlement || !towardCreditor
                                ? "text-[#22C55E]"
                                : "text-[#EF4444]"
                            }`}
                          >
                            {item.isSettlement || !towardCreditor ? "−" : "+"}
                            {formatCurrency(item.amount)}
                          </span>
                          <ChevronRight size={14} className="text-[#C7C7CC]" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="overflow-hidden rounded-xl border border-[#E5E5EA] bg-white">
              <p className="px-4 pb-3 pt-4 text-[11px] font-medium uppercase tracking-wider text-[#8E8E93]">
                Resumo
              </p>
              <Divider />
              <div className="flex items-center justify-between px-4 py-3.5">
                <p className="text-[13px] text-[#8E8E93]">
                  {settlement.creditor!.member!.display_name} pagou por{" "}
                  {settlement.debtor!.member!.display_name}
                </p>
                <span className="font-mono text-[14px] font-medium text-[#EF4444]">
                  {formatCurrency(settlement.bPaidForA)}
                </span>
              </div>
              <Divider />
              <div className="flex items-center justify-between px-4 py-3.5">
                <p className="text-[13px] text-[#8E8E93]">
                  {settlement.debtor!.member!.display_name} pagou por{" "}
                  {settlement.creditor!.member!.display_name}
                </p>
                <span className="font-mono text-[14px] font-medium text-[#22C55E]">
                  {formatCurrency(settlement.aPaidForB)}
                </span>
              </div>
              {settlement.settledAmount > 0 ? (
                <>
                  <Divider />
                  <div className="flex items-center justify-between px-4 py-3.5">
                    <p className="text-[13px] text-[#8E8E93]">Já acertado</p>
                    <span className="font-mono text-[14px] font-medium text-[#22C55E]">
                      −{formatCurrency(settlement.settledAmount)}
                    </span>
                  </div>
                </>
              ) : null}
              <div className="flex items-center justify-between border-t border-[#E5E5EA] px-4 py-3.5">
                <p className="text-[13px] font-medium text-[#111111]">
                  Diferença
                </p>
                <span className="font-mono text-[15px] font-medium text-[#EF4444]">
                  {formatCurrency(settlement.netAmount)}
                </span>
              </div>
            </div>

            {settlement.preview.length > 0 && !showDebtDetail && (
              <div>
                <p className="mb-3 text-[13px] font-medium uppercase tracking-wider text-[#8E8E93]">
                  Histórico
                </p>
                <div className="flex flex-col gap-0.5">
                  {settlement.preview.map((item) => (
                    <Link
                      key={item.id}
                      href={`/transactions/${item.id}`}
                      className="flex items-center gap-3 rounded-lg py-3 transition-colors active:bg-[#F2F2F7]"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white text-base">
                        {item.categoryIcon ?? "💸"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-medium text-[#111111]">
                          {item.title}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-[#3A3A3C]">
                          {item.consumerName} consumiu · {item.payerName} pagou
                          {item.cardName ? ` · ${item.cardName}` : ""} ·{" "}
                          {formatDate(item.date)}
                        </p>
                      </div>
                      <span className="shrink-0 font-mono text-[14px] font-medium text-[#8E8E93]">
                        {formatCurrency(item.amount)}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2 pt-1">
              <Btn
                variant="primary"
                size="lg"
                fullWidth
                wsColor="#111111"
                icon={<Check size={18} strokeWidth={2.5} />}
                onClick={() => setSettleOpen(true)}
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
                Copiar texto PIX
              </Btn>
            </div>

            <SettleEntreNosDialog
              open={settleOpen}
              onOpenChange={setSettleOpen}
              member={member}
              debtor={settlement.debtor!.member!}
              creditor={settlement.creditor!.member!}
              netAmount={settlement.netAmount}
              alreadySettled={settlement.settledAmount}
            />
          </>
        )}
      </div>
    </div>
  );
}
