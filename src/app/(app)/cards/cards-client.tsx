"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  useCards,
  useCardMutations,
  useWorkspaceMembers,
} from "@/lib/hooks/use-finance";
import { getBankName } from "@/lib/utils/banks";
import type { Card as CardType, WorkspaceMember } from "@/types";
import { EmptyState } from "@/components/shared/empty-state";
import { TopBar } from "@/components/design-system";
import { CardFormDialog } from "@/components/cards/card-form-dialog";
import { formatCurrency } from "@/lib/utils/format";
import { workspaceAccent } from "@/lib/utils/workspace";
import { CreditCard, Pencil, Plus, Wallet } from "lucide-react";

function darken(hex: string, amount = 0.25): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const n = parseInt(h, 16);
  const r = Math.max(0, ((n >> 16) & 255) * (1 - amount));
  const g = Math.max(0, ((n >> 8) & 255) * (1 - amount));
  const b = Math.max(0, (n & 255) * (1 - amount));
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

export function CardsPageClient({ member }: { member: WorkspaceMember }) {
  const { data: cards = [], isLoading } = useCards(member.workspace_id);
  const { data: members = [] } = useWorkspaceMembers(member.workspace_id);
  const cardMutations = useCardMutations(member.workspace_id);

  const activeCards = useMemo(() => cards.filter((c) => c.is_active), [cards]);
  const featured: CardType | undefined = activeCards[0];
  const accent = workspaceAccent(member.workspace?.type);

  return (
    <div className="flex flex-col pb-4">
      <TopBar
        title="Cartões"
        subtitle="Crédito e débito do workspace"
        className="md:px-6"
        rightEl={
          <div className="flex items-center gap-1.5">
            <Link
              href="/accounts"
              className="flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs font-medium text-foreground/50 transition-colors hover:bg-white/[0.06] hover:text-foreground/80"
            >
              <Wallet size={14} />
              Contas
            </Link>
            <CardFormDialog
              members={members}
              trigger={
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{ background: `${accent.color}20` }}
                  aria-label="Novo cartão"
                >
                  <Plus
                    size={18}
                    strokeWidth={2.5}
                    style={{ color: accent.color }}
                  />
                </button>
              }
              onSubmit={async (values) => {
                await cardMutations.create.mutateAsync(values);
              }}
            />
          </div>
        }
      />

      <div className="page-pad space-y-5 md:px-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : activeCards.length === 0 ? (
          <div className="space-y-4">
            <EmptyState
              title="Nenhum cartão cadastrado"
              description="Adicione um cartão para acompanhar faturas e limite."
            />
            <CardFormDialog
              members={members}
              trigger={
                <button
                  type="button"
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/[0.12] p-4"
                >
                  <Plus size={16} className="text-foreground/30" />
                  <span className="text-sm font-medium text-foreground/35">
                    Adicionar cartão
                  </span>
                </button>
              }
              onSubmit={async (values) => {
                await cardMutations.create.mutateAsync(values);
              }}
            />
          </div>
        ) : (
          <>
            {featured && (
              <>
                <Link
                  href={`/cards/${featured.id}`}
                  className="block"
                  aria-label={`Ver detalhes de ${featured.name}`}
                >
                  <FeatureCard
                    card={featured}
                    owner={members.find(
                      (m) => m.id === featured.owner_member_id
                    )}
                  />
                </Link>
                {featured.credit_limit != null && (
                  <div className="rounded-2xl border border-white/[0.06] bg-card p-4">
                    <div className="mb-1 flex items-center justify-between">
                      <p className="text-[13px] font-medium text-foreground/60">
                        Limite
                      </p>
                      <p className="font-mono text-[13px] font-semibold text-foreground/80">
                        {formatCurrency(Number(featured.credit_limit))}
                      </p>
                    </div>
                    <div className="flex justify-between text-[11px] text-foreground/25">
                      <span>Fecha dia {featured.closing_day ?? "—"}</span>
                      <span>Vence dia {featured.due_day ?? "—"}</span>
                    </div>
                  </div>
                )}
              </>
            )}

            <div>
              <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-foreground/60">
                Todos os cartões
              </h3>
              <div className="flex flex-col gap-2">
                {activeCards.map((card) => {
                  const owner = members.find(
                    (m) => m.id === card.owner_member_id
                  );
                  return (
                    <div
                      key={card.id}
                      className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-card p-4"
                    >
                      <Link
                        href={`/cards/${card.id}`}
                        className="flex min-w-0 flex-1 items-center gap-4 text-left transition-opacity hover:opacity-90"
                      >
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                          style={{
                            background: `linear-gradient(135deg, ${card.color}, ${darken(card.color)})`,
                          }}
                        >
                          <CreditCard
                            size={18}
                            strokeWidth={1.75}
                            className="text-white/80"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-semibold text-foreground/90">
                            {card.name}
                          </p>
                          <p className="mt-0.5 text-xs text-foreground/35">
                            •••• {card.last_four ?? "····"}
                            {owner ? ` · ${owner.display_name}` : ""}
                            {card.credit_limit != null
                              ? ` · Limite ${formatCurrency(Number(card.credit_limit))}`
                              : ""}
                          </p>
                        </div>
                      </Link>
                      <CardFormDialog
                        members={members}
                        initial={card}
                        trigger={
                          <button
                            type="button"
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] text-foreground/40 transition-colors hover:bg-white/[0.08] hover:text-foreground/70"
                            aria-label={`Editar ${card.name}`}
                          >
                            <Pencil size={14} />
                          </button>
                        }
                        onSubmit={async (values) => {
                          await cardMutations.update.mutateAsync({
                            id: card.id,
                            ...values,
                          });
                        }}
                      />
                      <button
                        type="button"
                        className="shrink-0 text-[11px] text-destructive/80"
                        onClick={() => cardMutations.deactivate.mutate(card.id)}
                      >
                        Desativar
                      </button>
                    </div>
                  );
                })}
              </div>

              <CardFormDialog
                members={members}
                trigger={
                  <button
                    type="button"
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/[0.12] p-4 transition-colors hover:border-white/25"
                  >
                    <Plus size={16} className="text-foreground/30" />
                    <span className="text-sm font-medium text-foreground/35">
                      Adicionar cartão
                    </span>
                  </button>
                }
                onSubmit={async (values) => {
                  await cardMutations.create.mutateAsync(values);
                }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function FeatureCard({
  card,
  owner,
}: {
  card: CardType;
  owner?: WorkspaceMember;
}) {
  const c1 = card.color || "#7C3AED";
  const c2 = darken(c1, 0.3);

  return (
    <div
      className="relative mx-auto w-full max-w-[360px] overflow-hidden rounded-3xl p-6 lg:mx-0"
      style={{
        background: `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`,
        aspectRatio: "1.586 / 1",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          background:
            "linear-gradient(115deg, rgba(255,255,255,0.4) 0%, transparent 50%)",
        }}
      />
      <div className="absolute left-6 top-6">
        <div className="flex h-7 w-9 items-center justify-center rounded-md bg-amber-300/80">
          <div className="flex h-4 w-5 items-center justify-center rounded-sm border-2 border-amber-600/60">
            <div className="h-2.5 w-2 border-r-2 border-amber-600/60" />
          </div>
        </div>
      </div>
      {owner && (
        <div className="absolute right-5 top-5">
          <div
            className="flex h-[26px] w-[26px] items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ backgroundColor: owner.avatar_color }}
          >
            {owner.display_name[0]}
          </div>
        </div>
      )}
      <div className="absolute bottom-10 left-6 right-6">
        <p className="font-mono text-[15px] font-semibold tracking-[0.2em] text-white/80">
          •••• •••• •••• {card.last_four ?? "····"}
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
  );
}
