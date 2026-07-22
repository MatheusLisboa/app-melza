"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  useAccounts,
  useAccountMutations,
  useWorkspaceMembers,
} from "@/lib/hooks/use-finance";
import { getBankName } from "@/lib/utils/banks";
import type { WorkspaceMember } from "@/types";
import { EmptyState } from "@/components/shared/empty-state";
import { TopBar } from "@/components/design-system";
import { AccountFormDialog } from "@/components/accounts/account-form-dialog";
import { formatCurrency } from "@/lib/utils/format";
import { workspaceAccent } from "@/lib/utils/workspace";
import { CreditCard, Pencil, Plus, Wallet } from "lucide-react";

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
              className="flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs font-medium text-foreground/50 transition-colors hover:bg-[var(--color-chip)] hover:text-foreground/80"
            >
              <CreditCard size={14} />
              Cartões
            </Link>
            <AccountFormDialog
              members={members}
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
                await accountMutations.create.mutateAsync(values);
              }}
            />
          </div>
        }
      />

      <div className="page-pad space-y-5 md:px-6">
        {active.length > 0 && (
          <div className="rounded-2xl border border-[#E5E5EA] bg-card p-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-foreground/35">
              Total nas contas
            </p>
            <p className="mt-1 font-mono text-[22px] font-semibold text-foreground/90">
              {formatCurrency(totalBalance)}
            </p>
          </div>
        )}

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : active.length === 0 ? (
          <div className="space-y-4">
            <EmptyState
              title="Nenhuma conta"
              description="Cadastre corrente, poupança ou dinheiro para lançar PIX."
            />
            <AccountFormDialog
              members={members}
              trigger={
                <button
                  type="button"
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/[0.12] p-4"
                >
                  <Plus size={16} className="text-foreground/30" />
                  <span className="text-sm font-medium text-foreground/35">
                    Adicionar conta
                  </span>
                </button>
              }
              onSubmit={async (values) => {
                await accountMutations.create.mutateAsync(values);
              }}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {active.map((account) => {
              const owner = members.find(
                (m) => m.id === account.owner_member_id
              );
              return (
                <div
                  key={account.id}
                  className="flex items-center gap-3 rounded-2xl border border-[#E5E5EA] bg-card p-4"
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
                    <p className="truncate text-[14px] font-semibold text-foreground/90">
                      {account.name}
                    </p>
                    <p className="mt-0.5 text-xs text-foreground/35">
                      {TYPE_LABEL[account.account_type] ?? account.account_type}
                      {account.bank ? ` · ${getBankName(account.bank)}` : ""}
                      {owner ? ` · ${owner.display_name}` : ""}
                      {account.is_shared === false ? " · pessoal" : " · compartilhada"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-[14px] font-semibold text-foreground/85">
                      {formatCurrency(Number(account.current_balance ?? 0))}
                    </p>
                    <p className="text-[10px] text-foreground/30">saldo</p>
                  </div>
                  <AccountFormDialog
                    members={members}
                    initial={account}
                    trigger={
                      <button
                        type="button"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-chip)] text-foreground/40 transition-colors hover:bg-[var(--color-chip)] hover:text-foreground/70"
                        aria-label={`Editar ${account.name}`}
                      >
                        <Pencil size={14} />
                      </button>
                    }
                    onSubmit={async (values) => {
                      await accountMutations.update.mutateAsync({
                        id: account.id,
                        ...values,
                      });
                    }}
                  />
                  <button
                    type="button"
                    className="shrink-0 text-[11px] text-destructive/80"
                    onClick={() =>
                      accountMutations.deactivate.mutate(account.id)
                    }
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
                  className="mt-1 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/[0.12] p-4 transition-colors hover:border-white/25"
                >
                  <Plus size={16} className="text-foreground/30" />
                  <span className="text-sm font-medium text-foreground/35">
                    Adicionar conta
                  </span>
                </button>
              }
              onSubmit={async (values) => {
                await accountMutations.create.mutateAsync(values);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
