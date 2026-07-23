"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  useCards,
  useCardMutations,
  useWorkspaceMembers,
} from "@/lib/hooks/use-finance";
import { getBankName } from "@/lib/utils/banks";
import type { Card as CardType, WorkspaceMember } from "@/types";
import type { CardInput } from "@/lib/validations/card";
import { EmptyState, DsSkeleton, TopBar, Btn } from "@/components/design-system";
import { CardFormDialog } from "@/components/cards/card-form-dialog";
import { formatCurrency } from "@/lib/utils/format";
import { Pencil, Plus, Wallet, CreditCard } from "lucide-react";
import { toast } from "sonner";

export function CardsPageClient({ member }: { member: WorkspaceMember }) {
  const { data: cards = [], isLoading } = useCards(member.workspace_id);
  const { data: members = [] } = useWorkspaceMembers(member.workspace_id);
  const cardMutations = useCardMutations(member.workspace_id);

  const activeCards = useMemo(() => cards.filter((c) => c.is_active), [cards]);
  const [createOpen, setCreateOpen] = useState(false);

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
              className="flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs font-medium text-[var(--color-silver)] transition-colors hover:bg-[var(--color-pearl)] hover:text-[var(--color-ink)]"
            >
              <Wallet size={14} />
              Contas
            </Link>
            <CardFormDialog
              members={members}
              open={createOpen}
              onOpenChange={setCreateOpen}
              trigger={
                <button
                  type="button"
                  className="touch-target flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-ink)] text-white"
                  aria-label="Novo cartão"
                >
                  <Plus size={18} strokeWidth={2.5} />
                </button>
              }
              onSubmit={async (values) => {
                try {
                  await cardMutations.create.mutateAsync(values);
                  toast.success("Cartão criado");
                } catch (e) {
                  toast.error(
                    e instanceof Error ? e.message : "Falha ao criar cartão"
                  );
                  throw e;
                }
              }}
            />
          </div>
        }
      />

      <div className="page-pad mt-6 space-y-5 md:px-6">
        {isLoading ? (
          <div className="space-y-3">
            <DsSkeleton h="h-24" className="rounded-xl" />
            <DsSkeleton h="h-24" className="rounded-xl" />
            <DsSkeleton h="h-24" className="rounded-xl" />
          </div>
        ) : activeCards.length === 0 ? (
          <EmptyState
            title="Nenhum cartão cadastrado"
            description="Adicione um cartão para acompanhar faturas e limite."
            actionLabel="Adicionar cartão"
            onAction={() => setCreateOpen(true)}
          />
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
                        try {
                          await cardMutations.update.mutateAsync({
                            id: card.id,
                            ...values,
                          });
                          toast.success("Cartão atualizado");
                        } catch (e) {
                          toast.error(
                            e instanceof Error
                              ? e.message
                              : "Falha ao atualizar"
                          );
                          throw e;
                        }
                      }}
                      onDeactivate={() =>
                        cardMutations.deactivate.mutate(card.id, {
                          onSuccess: () => toast.success("Cartão desativado"),
                          onError: (e) =>
                            toast.error(
                              e instanceof Error
                                ? e.message
                                : "Falha ao desativar"
                            ),
                        })
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
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--color-fog)] p-3.5 transition-colors hover:border-[var(--color-silver)]"
                >
                  <Plus size={16} className="text-[var(--color-silver)]" />
                  <span className="text-sm font-medium text-[var(--color-silver)]">
                    Adicionar cartão
                  </span>
                </button>
              }
              onSubmit={async (values) => {
                try {
                  await cardMutations.create.mutateAsync(values);
                  toast.success("Cartão criado");
                } catch (e) {
                  toast.error(
                    e instanceof Error ? e.message : "Falha ao criar cartão"
                  );
                  throw e;
                }
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
  const typeLabel = card.card_type === "debit" ? "Débito" : "Crédito";

  return (
    <div className="flex items-stretch overflow-hidden rounded-xl border border-[var(--color-fog)] bg-[var(--color-white)]">
      <Link
        href={`/cards/${card.id}`}
        className="flex min-w-0 flex-1 items-center gap-3 px-3.5 py-3.5 transition-colors active:bg-[var(--color-pearl)]"
        aria-label={`Ver detalhes de ${card.name}`}
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-pearl)] text-[var(--color-ink)]">
          <CreditCard size={18} strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-[var(--color-ink)]">
            {card.name}
          </p>
          <p className="mt-0.5 truncate text-[12px] text-[var(--color-silver)]">
            {getBankName(card.bank)} · {typeLabel}
            {owner ? ` · ${owner.display_name}` : ""}
            {` · fecha ${card.closing_day ?? "—"}`}
            {card.last_four ? ` · ••${card.last_four}` : ""}
          </p>
          {card.credit_limit != null && (
            <p className="mt-1 font-mono text-[12px] font-medium text-[var(--color-ink)]">
              Limite {formatCurrency(Number(card.credit_limit))}
            </p>
          )}
        </div>
      </Link>

      <div className="flex shrink-0 flex-col items-center justify-center gap-1 border-l border-[var(--color-fog)] px-2 py-2">
        <CardFormDialog
          members={members}
          initial={card}
          trigger={
            <button
              type="button"
              className="touch-target flex h-10 w-10 items-center justify-center rounded-lg text-[var(--color-silver)] transition-colors hover:bg-[var(--color-pearl)] hover:text-[var(--color-ink)]"
              aria-label={`Editar ${card.name}`}
            >
              <Pencil size={14} />
            </button>
          }
          onSubmit={onUpdate}
        />
        <Btn
          type="button"
          variant="ghost"
          size="sm"
          className="!min-h-0 px-1.5 py-1 text-[10px] text-[var(--color-expense)]"
          onClick={onDeactivate}
        >
          Excluir
        </Btn>
      </div>
    </div>
  );
}
