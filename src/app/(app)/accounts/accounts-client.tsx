"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  useAccounts,
  useAccountMutations,
  useWorkspaceMembers,
} from "@/lib/hooks/use-finance";
import { getBankName } from "@/lib/utils/banks";
import type { WorkspaceMember } from "@/types";
import { EmptyState, DsSkeleton, TopBar } from "@/components/design-system";
import { AccountFormDialog } from "@/components/accounts/account-form-dialog";
import { formatCurrency } from "@/lib/utils/format";
import { workspaceAccent } from "@/lib/utils/workspace";
import { CreditCard, Pencil, Plus, Wallet } from "lucide-react";
import { toast } from "sonner";

const TYPE_LABEL: Record<string, string> = {
  checking: "Corrente",
  savings: "Poupança",
  cash: "Dinheiro",
  investment: "Investimento",
};

export function AccountsPageClient({ member }: { member: WorkspaceMember }) {
  const { data: accounts = [], isLoading } = useAccounts(member.workspace_id);
  const { data: members = [] } = useWorkspaceMembers(member.workspace_id);
  const accountMutations = useAccountMutations(member.workspace_id);
  const accent = workspaceAccent(member.workspace?.type);
  const [createOpen, setCreateOpen] = useState(false);

  const active = useMemo(
    () => accounts.filter((a) => a.is_active),
    [accounts]
  );

  const totalBalance = useMemo(
    () =>
      active.reduce((s, a) => s + Number(a.current_balance ?? 0), 0),
    [active]
  );

  return (
    <div className="flex flex-col pb-4">
      <TopBar
        title="Contas"
        subtitle="Saldo disponível · PIX e débito"
        className="md:px-6"
        rightEl={
          <div className="flex items-center gap-1.5">
            <Link
              href="/cards"
              className="flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs font-medium text-[var(--color-silver)] transition-colors hover:bg-[var(--color-pearl)] hover:text-[var(--color-ink)]"
            >
              <CreditCard size={14} />
              Cartões
            </Link>
            <AccountFormDialog
              members={members}
              open={createOpen}
              onOpenChange={setCreateOpen}
              trigger={
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{ background: `${accent.color}20` }}
                  aria-label="Nova conta"
                >
                  <Plus
                    size={18}
                    strokeWidth={2.5}
                    style={{ color: accent.color }}
                  />
                </button>
              }
              onSubmit={async (values) => {
                try {
                  await accountMutations.create.mutateAsync(values);
                  toast.success("Conta criada");
                } catch (e) {
                  toast.error(
                    e instanceof Error ? e.message : "Falha ao criar conta"
                  );
                  throw e;
                }
              }}
            />
          </div>
        }
      />

      <div className="page-pad mt-6 space-y-5 md:px-6">
        {active.length > 0 && (
          <div className="rounded-2xl border border-[var(--color-fog)] bg-[var(--color-card)] p-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-silver)]">
              Total nas contas
            </p>
            <p className="mt-1 font-mono text-[22px] font-semibold text-[var(--color-ink)]">
              {formatCurrency(totalBalance)}
            </p>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            <DsSkeleton h="h-20" className="rounded-xl" />
            <DsSkeleton h="h-20" className="rounded-xl" />
            <DsSkeleton h="h-20" className="rounded-xl" />
          </div>
        ) : active.length === 0 ? (
          <>
            <EmptyState
              title="Nenhuma conta"
              description="Cadastre corrente, poupança ou dinheiro para lançar PIX."
              actionLabel="Adicionar conta"
              onAction={() => setCreateOpen(true)}
            />
          </>
        ) : (
          <div className="flex flex-col gap-2">
            {active.map((account) => {
              const owner = members.find(
                (m) => m.id === account.owner_member_id
              );
              return (
                <div
                  key={account.id}
                  className="flex items-center gap-3 rounded-2xl border border-[var(--color-fog)] bg-[var(--color-card)] p-4"
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{
                      backgroundColor: `${account.color ?? "#111111"}22`,
                    }}
                  >
                    <Wallet
                      size={18}
                      style={{ color: account.color ?? "#111111" }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-[var(--color-ink)]">
                      {account.name}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--color-silver)]">
                      {TYPE_LABEL[account.account_type] ?? account.account_type}
                      {account.bank ? ` · ${getBankName(account.bank)}` : ""}
                      {owner ? ` · ${owner.display_name}` : ""}
                      {account.is_shared === false ? " · pessoal" : " · compartilhada"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-[14px] font-semibold text-[var(--color-ink)]">
                      {formatCurrency(Number(account.current_balance ?? 0))}
                    </p>
                    <p className="text-[10px] text-[var(--color-silver)]">saldo</p>
                  </div>
                  <AccountFormDialog
                    members={members}
                    initial={account}
                    trigger={
                      <button
                        type="button"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-pearl)] text-[var(--color-silver)] transition-colors hover:text-[var(--color-ink)]"
                        aria-label={`Editar ${account.name}`}
                      >
                        <Pencil size={14} />
                      </button>
                    }
                    onSubmit={async (values) => {
                      try {
                        await accountMutations.update.mutateAsync({
                          id: account.id,
                          ...values,
                        });
                        toast.success("Conta atualizada");
                      } catch (e) {
                        toast.error(
                          e instanceof Error ? e.message : "Falha ao atualizar"
                        );
                        throw e;
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="shrink-0 text-[11px] text-[#EF4444]/80"
                    onClick={() => {
                      accountMutations.deactivate.mutate(account.id, {
                        onSuccess: () => toast.success("Conta desativada"),
                        onError: (e) =>
                          toast.error(
                            e instanceof Error ? e.message : "Falha ao desativar"
                          ),
                      });
                    }}
                  >
                    Desativar
                  </button>
                </div>
              );
            })}

            <AccountFormDialog
              members={members}
              trigger={
                <button
                  type="button"
                  className="mt-1 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--color-fog)] p-4 transition-colors hover:border-[var(--color-mist)]"
                >
                  <Plus size={16} className="text-[var(--color-silver)]" />
                  <span className="text-sm font-medium text-[var(--color-silver)]">
                    Adicionar conta
                  </span>
                </button>
              }
              onSubmit={async (values) => {
                try {
                  await accountMutations.create.mutateAsync(values);
                  toast.success("Conta criada");
                } catch (e) {
                  toast.error(
                    e instanceof Error ? e.message : "Falha ao criar conta"
                  );
                  throw e;
                }
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
