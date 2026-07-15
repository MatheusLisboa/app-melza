"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  useCards,
  useCardMutations,
  useWorkspaceMembers,
} from "@/lib/hooks/use-finance";
import { getBankColor, getBankName } from "@/lib/utils/banks";
import type { Card as CardType, WorkspaceMember } from "@/types";
import type { CardInput } from "@/lib/validations/card";
import { EmptyState } from "@/components/shared/empty-state";
import { TopBar } from "@/components/design-system";
import { CardFormDialog } from "@/components/cards/card-form-dialog";
import { formatCurrency } from "@/lib/utils/format";
import { workspaceAccent } from "@/lib/utils/workspace";
import { Pencil, Plus, Wallet } from "lucide-react";

function cardBrandColor(card: CardType): string {
  if (card.bank) return getBankColor(card.bank);
  return card.color || "#111111";
}

function isLightBrand(color: string): boolean {
  const hex = color.replace("#", "");
  if (hex.length !== 6) return false;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.65;
}

export function CardsPageClient({ member }: { member: WorkspaceMember }) {
  const { data: cards = [], isLoading } = useCards(member.workspace_id);
  const { data: members = [] } = useWorkspaceMembers(member.workspace_id);
  const cardMutations = useCardMutations(member.workspace_id);

  const activeCards = useMemo(() => cards.filter((c) => c.is_active), [cards]);
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
              className="flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs font-medium text-[var(--color-text-2)] transition-colors hover:bg-[var(--color-chip)] hover:text-[var(--color-text)]"
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

      <div className="page-pad space-y-3 md:px-6">
        {isLoading ? (
          <p className="text-sm text-[var(--color-text-2)]">Carregando…</p>
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
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--color-line)] p-4"
                >
                  <Plus size={16} className="text-[var(--color-text-2)]" />
                  <span className="text-sm font-medium text-[var(--color-text-2)]">
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
            <ul className="flex flex-col gap-2.5">
              {activeCards.map((card) => {
                const owner = members.find(
                  (m) => m.id === card.owner_member_id
                );
                return (
                  <li key={card.id}>
                    <CompactCardRow
                      card={card}
                      owner={owner}
                      members={members}
                      onUpdate={async (values) => {
                        await cardMutations.update.mutateAsync({
                          id: card.id,
                          ...values,
                        });
                      }}
                      onDeactivate={() =>
                        cardMutations.deactivate.mutate(card.id)
                      }
                    />
                  </li>
                );
              })}
            </ul>

            <CardFormDialog
              members={members}
              trigger={
                <button
                  type="button"
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--color-line)] p-3.5 transition-colors hover:border-[var(--color-text-2)]"
                >
                  <Plus size={16} className="text-[var(--color-text-2)]" />
                  <span className="text-sm font-medium text-[var(--color-text-2)]">
                    Adicionar cartão
                  </span>
                </button>
              }
              onSubmit={async (values) => {
                await cardMutations.create.mutateAsync(values);
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}

function CompactCardRow({
  card,
  owner,
  members,
  onUpdate,
  onDeactivate,
}: {
  card: CardType;
  owner?: WorkspaceMember;
  members: WorkspaceMember[];
  onUpdate: (values: CardInput) => Promise<void>;
  onDeactivate: () => void;
}) {
  const brand = cardBrandColor(card);
  const light = isLightBrand(brand);
  const fg = light ? "#111111" : "#FFFFFF";
  const fgMuted = light ? "rgba(17,17,17,0.65)" : "rgba(255,255,255,0.72)";
  const typeLabel = card.card_type === "debit" ? "Débito" : "Crédito";

  return (
    <div className="flex items-stretch overflow-hidden rounded-[14px] border border-[var(--color-line)] bg-[var(--color-card)]">
      <Link
        href={`/cards/${card.id}`}
        className="flex min-w-0 flex-1 items-stretch transition-opacity hover:opacity-95"
        aria-label={`Ver detalhes de ${card.name}`}
      >
        <div
          className="relative flex w-[112px] shrink-0 flex-col justify-between overflow-hidden p-3 sm:w-[128px]"
          style={{ backgroundColor: brand }}
        >
          <div
            className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full opacity-25"
            style={{ background: light ? "#000" : "#fff" }}
          />
          <p
            className="relative truncate text-[10px] font-medium uppercase tracking-wider"
            style={{ color: fgMuted }}
          >
            {getBankName(card.bank)}
          </p>
          <div className="relative">
            <div
              className="mb-2 h-5 w-7 rounded-[3px]"
              style={{
                background: light
                  ? "rgba(0,0,0,0.14)"
                  : "rgba(255,255,255,0.22)",
              }}
            />
            <p
              className="font-mono text-[11px] font-medium tracking-wider"
              style={{ color: fg }}
            >
              ••{card.last_four ?? "····"}
            </p>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-3.5 py-3">
          <p className="truncate text-[14px] font-medium text-[var(--color-text)]">
            {card.name}
          </p>
          <p className="truncate text-[11px] text-[var(--color-text-2)]">
            {typeLabel}
            {owner ? ` · ${owner.display_name}` : ""}
            {` · fecha ${card.closing_day ?? "—"}`}
          </p>
          {card.credit_limit != null && (
            <p className="mt-0.5 font-mono text-[12px] font-medium text-[var(--color-text)]">
              Limite {formatCurrency(Number(card.credit_limit))}
            </p>
          )}
        </div>
      </Link>

      <div className="flex shrink-0 flex-col items-center justify-center gap-1 border-l border-[var(--color-line)] px-2 py-2">
        <CardFormDialog
          members={members}
          initial={card}
          trigger={
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-2)] transition-colors hover:bg-[var(--color-chip)] hover:text-[var(--color-text)]"
              aria-label={`Editar ${card.name}`}
            >
              <Pencil size={14} />
            </button>
          }
          onSubmit={onUpdate}
        />
        <button
          type="button"
          className="rounded-lg px-1.5 py-1 text-[10px] font-medium text-[#EF4444]/80 transition-colors hover:bg-[var(--color-chip)] hover:text-[#EF4444]"
          onClick={onDeactivate}
        >
          Excluir
        </button>
      </div>
    </div>
  );
}
