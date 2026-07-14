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
    const balances = new Map<string, number>();
    const pairFlow = new Map<string, number>();
    const timeline: {
      id: string;
      emoji: string;
      title: string;
      date: string;
      amount: number;
      consumerId: string;
      payerId: string;
    }[] = [];

    for (const m of members) balances.set(m.id, 0);

    for (const tx of txs) {
      const amount = Number(tx.amount);
      const payerId = tx.paid_by_member_id;
      const ownerId =
        tx.cards?.owner_member_id ?? tx.accounts?.owner_member_id ?? null;
      if (!payerId || !ownerId || payerId === ownerId) continue;

      // Owner emprestou o meio; payer deve ao owner
      balances.set(payerId, (balances.get(payerId) ?? 0) - amount);
      balances.set(ownerId, (balances.get(ownerId) ?? 0) + amount);

      // Flow key: payer → consumer/owner asymmetry for resumo
      const forward = `${ownerId}>${payerId}`;
      pairFlow.set(forward, (pairFlow.get(forward) ?? 0) + amount);

      timeline.push({
        id: tx.id,
        emoji: tx.category?.icon ?? "💸",
        title: tx.description,
        date: formatDate(tx.transaction_date),
        amount,
        consumerId: payerId,
        payerId: ownerId,
      });
    }

    const ranked = Array.from(balances.entries())
      .map(([id, net]) => ({
        member: members.find((m) => m.id === id),
        net,
      }))
      .filter((r) => r.member)
      .sort((a, b) => a.net - b.net);

    const debtor = ranked.find((r) => r.net < -1);
    const creditor = [...ranked].reverse().find((r) => r.net > 1);
    const netAmount =
      debtor && creditor
        ? Math.min(Math.abs(debtor.net), Math.abs(creditor.net))
        : 0;

    const a = debtor?.member?.id;
    const b = creditor?.member?.id;
    const aPaidForB = a && b ? pairFlow.get(`${a}>${b}`) ?? 0 : 0;
    const bPaidForA = a && b ? pairFlow.get(`${b}>${a}`) ?? 0 : 0;

    return {
      debtor,
      creditor,
      netAmount,
      timeline: timeline.slice(0, 8),
      aPaidForB,
      bPaidForA,
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
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06]"
            aria-label="Compartilhar"
          >
            <Share2 size={16} strokeWidth={2} className="text-white/60" />
          </button>
        }
      />

      <div className="page-pad space-y-5 md:px-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Calculando acertos…</p>
        ) : settled ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-[#22C55E]/20 bg-[#22C55E]/10 py-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#22C55E]/20">
              <CheckCircle size={24} className="text-[#22C55E]" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-[#22C55E]">Acerto registrado!</p>
              <p className="mt-1 text-xs text-white/35">
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
            <div
              className="relative overflow-hidden rounded-3xl p-6"
              style={{
                background: "linear-gradient(135deg, #1A1A1F 0%, #111113 100%)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <div
                className="absolute left-6 top-6 h-20 w-20 rounded-full opacity-20 blur-2xl"
                style={{
                  background: settlement.debtor!.member!.avatar_color,
                }}
              />
              <div
                className="absolute right-6 top-6 h-20 w-20 rounded-full opacity-20 blur-2xl"
                style={{
                  background: settlement.creditor!.member!.avatar_color,
                }}
              />

              <div className="relative z-10 mb-6 flex items-center justify-between">
                <div className="flex flex-col items-center gap-2">
                  <div className="relative">
                    <Avatar
                      member={toDsMember(settlement.debtor!.member!)}
                      size={56}
                    />
                    <div className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#09090B] bg-[#EF4444]">
                      <ArrowUpRight
                        size={10}
                        strokeWidth={3}
                        className="text-white"
                      />
                    </div>
                  </div>
                  <p className="text-[13px] font-semibold text-white/80">
                    {settlement.debtor!.member!.display_name}
                  </p>
                  <Badge label="Deve" color="#EF4444" bg="#EF444415" />
                </div>

                <div className="flex flex-1 flex-col items-center gap-2 px-4">
                  <div className="flex w-full items-center">
                    <div
                      className="h-px flex-1"
                      style={{
                        background: `linear-gradient(90deg, ${settlement.debtor!.member!.avatar_color}60, ${settlement.creditor!.member!.avatar_color}60)`,
                      }}
                    />
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/[0.06]">
                      <ArrowRight
                        size={12}
                        strokeWidth={2.5}
                        className="text-white/50"
                      />
                    </div>
                    <div
                      className="h-px flex-1"
                      style={{
                        background: `linear-gradient(90deg, ${settlement.debtor!.member!.avatar_color}60, ${settlement.creditor!.member!.avatar_color}60)`,
                      }}
                    />
                  </div>
                  <span className="text-[10px] font-medium text-white/30">
                    transferência sugerida
                  </span>
                </div>

                <div className="flex flex-col items-center gap-2">
                  <div className="relative">
                    <Avatar
                      member={toDsMember(settlement.creditor!.member!)}
                      size={56}
                    />
                    <div className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#09090B] bg-[#22C55E]">
                      <ArrowDownLeft
                        size={10}
                        strokeWidth={3}
                        className="text-white"
                      />
                    </div>
                  </div>
                  <p className="text-[13px] font-semibold text-white/80">
                    {settlement.creditor!.member!.display_name}
                  </p>
                  <Badge label="Recebe" color="#22C55E" bg="#22C55E15" />
                </div>
              </div>

              <div className="flex flex-col items-center gap-1.5 border-t border-white/[0.06] py-5">
                <p className="text-xs font-medium uppercase tracking-wider text-white/35">
                  Saldo líquido
                </p>
                <MoneyDisplay
                  amount={settlement.netAmount}
                  size="xl"
                  color="#EF4444"
                />
                <p className="text-center text-sm text-white/45">
                  <span className="font-semibold text-white/70">
                    {settlement.debtor!.member!.display_name}
                  </span>{" "}
                  deve pagar para{" "}
                  <span className="font-semibold text-white/70">
                    {settlement.creditor!.member!.display_name}
                  </span>
                </p>
              </div>
            </div>

            {/* Resumo */}
            <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#111113]">
              <p className="px-4 pb-3 pt-4 text-[11px] font-semibold uppercase tracking-wider text-white/35">
                Resumo
              </p>
              <Divider />
              <div className="flex items-center justify-between px-4 py-3.5">
                <div className="flex items-center gap-2">
                  <span className="text-base">⬆️</span>
                  <p className="text-[13px] text-white/65">
                    {settlement.creditor!.member!.display_name} pagou para{" "}
                    {settlement.debtor!.member!.display_name}
                  </p>
                </div>
                <span className="font-mono text-[14px] font-semibold text-[#EF4444]">
                  {formatCurrency(settlement.bPaidForA)}
                </span>
              </div>
              <Divider />
              <div className="flex items-center justify-between px-4 py-3.5">
                <div className="flex items-center gap-2">
                  <span className="text-base">⬇️</span>
                  <p className="text-[13px] text-white/65">
                    {settlement.debtor!.member!.display_name} pagou para{" "}
                    {settlement.creditor!.member!.display_name}
                  </p>
                </div>
                <span className="font-mono text-[14px] font-semibold text-[#22C55E]">
                  {formatCurrency(settlement.aPaidForB)}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-3.5">
                <p className="text-[13px] font-semibold text-white/80">
                  Diferença
                </p>
                <span className="font-mono text-[15px] font-bold text-[#EF4444]">
                  {formatCurrency(settlement.netAmount)}
                </span>
              </div>
            </div>

            {/* Histórico */}
            {settlement.timeline.length > 0 && (
              <div>
                <p className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-white/60">
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
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1C1C1F] text-base">
                          {item.emoji}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-medium text-white/85">
                            {item.title}
                          </p>
                          <div className="mt-0.5 flex items-center gap-1.5">
                            <div
                              className="flex h-3 w-3 items-center justify-center rounded-full text-[7px] font-bold text-white"
                              style={{
                                backgroundColor: consumer.avatar_color,
                              }}
                            >
                              {consumer.display_name[0]}
                            </div>
                            <span className="text-[11px] text-white/30">
                              consumiu
                            </span>
                            <span className="text-white/15">·</span>
                            <div
                              className="flex h-3 w-3 items-center justify-center rounded-full text-[7px] font-bold text-white"
                              style={{ backgroundColor: payer.avatar_color }}
                            >
                              {payer.display_name[0]}
                            </div>
                            <span className="truncate text-[11px] text-white/30">
                              pagou · {item.date}
                            </span>
                          </div>
                        </div>
                        <span className="shrink-0 font-mono text-[14px] font-semibold text-white/60">
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
                wsColor="#22C55E"
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
