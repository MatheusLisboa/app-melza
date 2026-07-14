"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Copy, Eye, Lock, Pencil, QrCode } from "lucide-react";
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
  TopBar,
  TxRow,
  toDsMember,
} from "@/components/design-system";
import { CardFormDialog } from "@/components/cards/card-form-dialog";
import {
  formatCurrency,
  formatDate,
} from "@/lib/utils/format";
import {
  cardAvailableLimit,
  getCurrentInvoiceCycle,
  sumCardCommittedLimit,
} from "@/lib/finance/card-cycle";
import { getBankName } from "@/lib/utils/banks";

function darken(hex: string, amount = 0.3): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const n = parseInt(h, 16);
  const r = Math.max(0, ((n >> 16) & 255) * (1 - amount));
  const g = Math.max(0, ((n >> 8) & 255) * (1 - amount));
  const b = Math.max(0, (n & 255) * (1 - amount));
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

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
      if (error) throw error;
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
          category:categories(*),
          card:cards(*),
          paid_by:workspace_members!paid_by_member_id(*),
          consumer:workspace_members!consumer_member_id(*)
        `
        )
        .eq("workspace_id", member.workspace_id)
        .eq("card_id", cardId)
        .neq("status", "cancelled")
        .order("transaction_date", { ascending: false })
        .limit(8);
      if (error) throw error;
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
      if (error) throw error;
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
        <p className="mt-8 text-sm text-muted-foreground">Carregando…</p>
      </div>
    );
  }

  const c1 = card.color || "#7C3AED";
  const c2 = darken(c1);
  const owner = members.find((m) => m.id === card.owner_member_id);
  const limit = card.credit_limit != null ? Number(card.credit_limit) : null;
  const available = cardAvailableLimit(limit, committed);

  return (
    <div className="pb-8">
      <TopBar
        title={card.name}
        onBack={() => router.back()}
        rightEl={
          <CardFormDialog
            members={members}
            initial={card}
            trigger={
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06] text-foreground/50"
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

      <div className="px-5">
        <div
          className="relative mx-auto mt-2 w-full max-w-[360px] overflow-hidden rounded-3xl p-6"
          style={{
            background: `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`,
            aspectRatio: "1.586 / 1",
          }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-20"
            style={{
              background:
                "linear-gradient(115deg, rgba(255,255,255,0.5) 0%, transparent 50%)",
            }}
          />
          <div className="absolute left-6 top-6">
            <div className="h-7 w-9 rounded-md bg-amber-300/80" />
          </div>
          {owner && (
            <div className="absolute right-5 top-5">
              <AvatarLite
                name={owner.display_name}
                color={owner.avatar_color}
              />
            </div>
          )}
          <div className="absolute bottom-10 left-6 right-6">
            <p className="font-mono text-[15px] font-semibold tracking-[0.2em] text-white/80">
              {showNumber
                ? `•••• •••• •••• ${card.last_four ?? "····"}`
                : "•••• •••• •••• ••••"}
            </p>
          </div>
          <div className="absolute bottom-5 left-6 right-6 flex items-center justify-between">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-white/70">
              {card.name}
            </p>
            <p className="font-mono text-[11px] text-white/50">
              {getBankName(card.bank)}
            </p>
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          {[
            {
              icon: Eye,
              label: "Ver final",
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
              icon: Lock,
              label: card.is_active ? "Ativo" : "Inativo",
              onClick: () => undefined,
            },
            {
              icon: QrCode,
              label: "Fatura",
              onClick: () => router.push("/invoices"),
            },
          ].map(({ icon: Icon, label, onClick }) => (
            <button
              key={label}
              type="button"
              onClick={onClick}
              className="flex flex-1 flex-col items-center gap-1.5 rounded-xl bg-[#18181B] py-3"
            >
              <Icon size={18} strokeWidth={1.75} className="text-white/50" />
              <span className="text-[10px] font-medium text-white/35">
                {label}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-white/[0.06] bg-[#111113]">
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
                futureCommitted > 0
                  ? formatCurrency(futureCommitted)
                  : "—",
            },
            {
              label: "Disponível",
              value: available != null ? formatCurrency(available) : "—",
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
          ].map((row, i, arr) => (
            <div key={row.label}>
              <div className="flex items-center justify-between px-4 py-3.5">
                <p className="text-sm text-white/40">{row.label}</p>
                <p className="font-mono text-sm font-semibold text-white/80">
                  {row.value}
                </p>
              </div>
              {i < arr.length - 1 && <Divider />}
            </div>
          ))}
        </div>
        <p className="mt-1.5 px-1 text-[11px] text-white/25">
          Disponível = limite − ciclo atual − parcelas futuras (ex.: 3/12
          compromete as 9 restantes).
        </p>

        <h3 className="mb-2 mt-5 text-[13px] font-semibold uppercase tracking-wider text-white/60">
          Transações recentes
        </h3>
        {recent.length === 0 ? (
          <p className="text-sm text-white/30">Nenhum lançamento neste cartão.</p>
        ) : (
          recent.map((tx) => {
            const payer = tx.paid_by ? toDsMember(tx.paid_by) : null;
            const consumer = tx.consumer
              ? toDsMember(tx.consumer)
              : payer;
            const cardOwner = owner
              ? toDsMember(owner)
              : payer;
            const isIncome =
              tx.transaction_type === "income" ||
              tx.transaction_type === "loan_received";
            return (
              <Link key={tx.id} href={`/transactions/${tx.id}`}>
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
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}

function AvatarLite({ name, color }: { name: string; color: string }) {
  return (
    <div
      className="flex h-[26px] w-[26px] items-center justify-center rounded-full text-[10px] font-bold text-white"
      style={{ backgroundColor: color }}
    >
      {name[0]}
    </div>
  );
}
