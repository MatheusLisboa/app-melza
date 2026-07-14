"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useAccounts,
  useAccountMutations,
  useCards,
  useCardMutations,
  useWorkspaceMembers,
} from "@/lib/hooks/use-finance";
import { BANKS, getBankColor, getBankName } from "@/lib/utils/banks";
import {
  accountSchema,
  cardSchema,
  type AccountInput,
  type CardInput,
} from "@/lib/validations/card";
import type { Card as CardType, WorkspaceMember } from "@/types";
import { EmptyState } from "@/components/shared/empty-state";
import { TopBar } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils/format";
import { workspaceAccent } from "@/lib/utils/workspace";
import { MoneyInput } from "@/components/transactions/money-input";
import {
  DayOfMonthInput,
  DigitMaskInput,
} from "@/components/shared/masked-input";
import { CreditCard, Plus } from "lucide-react";
import Link from "next/link";

function darken(hex: string, amount = 0.25): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const n = parseInt(h, 16);
  const r = Math.max(0, ((n >> 16) & 255) * (1 - amount));
  const g = Math.max(0, ((n >> 8) & 255) * (1 - amount));
  const b = Math.max(0, (n & 255) * (1 - amount));
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

export function CardsAccountsPage({ member }: { member: WorkspaceMember }) {
  const { data: cards = [], isLoading: loadingCards } = useCards(member.workspace_id);
  const { data: accounts = [], isLoading: loadingAccounts } = useAccounts(
    member.workspace_id
  );
  const { data: members = [] } = useWorkspaceMembers(member.workspace_id);
  const cardMutations = useCardMutations(member.workspace_id);
  const accountMutations = useAccountMutations(member.workspace_id);

  const activeCards = useMemo(
    () => cards.filter((c) => c.is_active),
    [cards]
  );
  const featured: CardType | undefined = activeCards[0];
  const accent = workspaceAccent(member.workspace?.type);

  return (
    <div className="flex flex-col pb-4">
      <TopBar
        title="Cartões"
        subtitle="Meios de pagamento do workspace"
        className="md:px-6"
        rightEl={
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
        }
      />

      <div className="page-pad space-y-6 md:px-6">
        <Tabs defaultValue="cards">
          <TabsList className="bg-white/[0.04]">
            <TabsTrigger value="cards">Cartões</TabsTrigger>
            <TabsTrigger value="accounts">Contas</TabsTrigger>
          </TabsList>

          <TabsContent value="cards" className="mt-4 space-y-5">
            {loadingCards ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : activeCards.length === 0 ? (
              <EmptyState
                title="Nenhum cartão cadastrado"
                description="Adicione um cartão para acompanhar faturas e lançamentos."
              />
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
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-[13px] font-medium text-foreground/60">
                            Limite
                          </p>
                          <p className="font-mono text-[13px] font-semibold text-foreground/80">
                            {formatCurrency(Number(featured.credit_limit))}
                          </p>
                        </div>
                        <div className="flex justify-between text-[11px] text-foreground/25">
                          <span>
                            Fecha dia {featured.closing_day ?? "—"}
                          </span>
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
                        <Link
                          key={card.id}
                          href={`/cards/${card.id}`}
                          className="flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-card p-4 text-left transition-colors hover:bg-[#141417]"
                        >
                          <div
                            className="flex h-10 w-10 items-center justify-center rounded-xl"
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
                            <p className="text-[14px] font-semibold text-foreground/90">
                              {card.name}
                            </p>
                            <div className="mt-0.5 flex items-center gap-2 text-xs text-foreground/35">
                              <span>•••• {card.last_four ?? "····"}</span>
                              {owner && (
                                <>
                                  <span className="text-foreground/15">·</span>
                                  <span
                                    className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-[7px] font-bold text-white"
                                    style={{
                                      backgroundColor: owner.avatar_color,
                                    }}
                                  >
                                    {owner.display_name[0]}
                                  </span>
                                  <span>{owner.display_name}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[13px] font-medium capitalize text-foreground/65">
                              {getBankName(card.bank)}
                            </p>
                            <button
                              type="button"
                              className="mt-1 text-[11px] text-destructive/80"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                cardMutations.deactivate.mutate(card.id);
                              }}
                            >
                              Desativar
                            </button>
                          </div>
                        </Link>
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
          </TabsContent>

          <TabsContent value="accounts" className="mt-4 space-y-4">
            <div className="flex justify-end">
              <AccountFormDialog
                members={members}
                onSubmit={async (values) => {
                  await accountMutations.create.mutateAsync(values);
                }}
              />
            </div>
            {loadingAccounts ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : accounts.filter((a) => a.is_active).length === 0 ? (
              <EmptyState
                title="Nenhuma conta"
                description="Cadastre contas corrente, poupança ou dinheiro."
              />
            ) : (
              <div className="flex flex-col gap-2">
                {accounts
                  .filter((a) => a.is_active)
                  .map((account) => {
                    const owner = members.find(
                      (m) => m.id === account.owner_member_id
                    );
                    return (
                      <div
                        key={account.id}
                        className="flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-card p-4"
                      >
                        <div
                          className="h-10 w-10 rounded-xl"
                          style={{
                            backgroundColor: account.color ?? "#6366f1",
                          }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-[14px] font-semibold">
                            {account.name}
                          </p>
                          <p className="text-xs capitalize text-foreground/35">
                            {account.account_type}
                            {owner ? ` · ${owner.display_name}` : ""}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() =>
                            accountMutations.deactivate.mutate(account.id)
                          }
                        >
                          Desativar
                        </Button>
                      </div>
                    );
                  })}
              </div>
            )}
          </TabsContent>
        </Tabs>
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

function CardFormDialog({
  members,
  onSubmit,
  trigger,
}: {
  members: WorkspaceMember[];
  onSubmit: (values: CardInput) => Promise<void>;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm<CardInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(cardSchema) as any,
    defaultValues: {
      name: "",
      bank: "nubank",
      card_type: "credit",
      color: getBankColor("nubank"),
      last_four: "",
      owner_member_id: members[0]?.id ?? null,
      closing_day: 1,
      due_day: 10,
      credit_limit: null,
    },
  });

  useEffect(() => {
    if (members[0]?.id) {
      form.setValue("owner_member_id", members[0].id);
    }
  }, [members, form]);

  const bank = form.watch("bank");

  useEffect(() => {
    form.setValue("color", getBankColor(bank));
  }, [bank, form]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Novo cartão
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo cartão</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={form.handleSubmit(async (values) => {
            await onSubmit({
              ...values,
              last_four: values.last_four || null,
              credit_limit: values.credit_limit ?? null,
            });
            setOpen(false);
            form.reset();
          })}
        >
          <div className="space-y-1">
            <Label>Nome</Label>
            <Input {...form.register("name")} placeholder="Nubank Matheus" />
          </div>
          <div className="space-y-1">
            <Label>Banco</Label>
            <Select
              value={form.watch("bank")}
              onValueChange={(v) => form.setValue("bank", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BANKS.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select
                value={form.watch("card_type")}
                onValueChange={(v) =>
                  form.setValue("card_type", v as "credit" | "debit")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="credit">Crédito</SelectItem>
                  <SelectItem value="debit">Débito</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Final</Label>
              <DigitMaskInput
                maxLength={4}
                placeholder="1234"
                value={form.watch("last_four") ?? ""}
                onValueChange={(v) => form.setValue("last_four", v)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Dono</Label>
            <Select
              value={form.watch("owner_member_id") ?? undefined}
              onValueChange={(v) => form.setValue("owner_member_id", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Membro" />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Fecha</Label>
              <DayOfMonthInput
                placeholder="15"
                value={form.watch("closing_day")}
                onValueChange={(v) =>
                  form.setValue("closing_day", v ?? undefined)
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Vence</Label>
              <DayOfMonthInput
                placeholder="22"
                value={form.watch("due_day")}
                onValueChange={(v) => form.setValue("due_day", v ?? undefined)}
              />
            </div>
            <div className="space-y-1">
              <Label>Limite</Label>
              <MoneyInput
                value={Number(form.watch("credit_limit") ?? 0)}
                onValueChange={(v) =>
                  form.setValue("credit_limit", v > 0 ? v : null)
                }
              />
            </div>
          </div>
          <Button type="submit" className="w-full">
            Salvar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AccountFormDialog({
  members,
  onSubmit,
}: {
  members: WorkspaceMember[];
  onSubmit: (values: AccountInput) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm<AccountInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(accountSchema) as any,
    defaultValues: {
      name: "",
      account_type: "checking",
      bank: "nubank",
      color: getBankColor("nubank"),
      owner_member_id: members[0]?.id ?? null,
    },
  });

  const bank = form.watch("bank") ?? "nubank";
  useEffect(() => {
    form.setValue("color", getBankColor(bank));
  }, [bank, form]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Nova conta
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova conta</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={form.handleSubmit(async (values) => {
            await onSubmit(values);
            setOpen(false);
            form.reset();
          })}
        >
          <div className="space-y-1">
            <Label>Nome</Label>
            <Input {...form.register("name")} placeholder="Nubank Conta" />
          </div>
          <div className="space-y-1">
            <Label>Tipo</Label>
            <Select
              value={form.watch("account_type")}
              onValueChange={(v) =>
                form.setValue(
                  "account_type",
                  v as AccountInput["account_type"]
                )
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="checking">Corrente</SelectItem>
                <SelectItem value="savings">Poupança</SelectItem>
                <SelectItem value="cash">Dinheiro</SelectItem>
                <SelectItem value="investment">Investimento</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Banco</Label>
            <Select
              value={form.watch("bank") ?? "other"}
              onValueChange={(v) => form.setValue("bank", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BANKS.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Dono</Label>
            <Select
              value={form.watch("owner_member_id") ?? undefined}
              onValueChange={(v) => form.setValue("owner_member_id", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full">
            Salvar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
