"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  transactionSchema,
  type PaymentChannel,
  type TransactionInput,
} from "@/lib/validations/transaction";
import { createTransactionAction } from "@/lib/actions/transactions";
import { invalidateFinanceQueries } from "@/lib/finance/invalidate";
import { MoneyInput } from "@/components/transactions/money-input";
import { CardSelector } from "@/components/transactions/card-selector";
import { useAccounts, useCards, useWorkspaceMembers } from "@/lib/hooks/use-finance";
import type { AccountType, Category, WorkspaceMember } from "@/types";
import { toISODate } from "@/lib/utils/format";
import { Btn } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { IntegerMaskInput } from "@/components/shared/masked-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  ArrowLeftRight,
  CalendarDays,
  CreditCard,
  Banknote,
  HandCoins,
  Plus,
  QrCode,
  Sparkles,
  Wallet,
} from "lucide-react";

const TX_TYPES: {
  value: TransactionInput["transaction_type"];
  label: string;
  short: string;
}[] = [
  { value: "expense", label: "Despesa", short: "Despesa" },
  { value: "income", label: "Receita", short: "Receita" },
  { value: "transfer", label: "Transferência", short: "Transfer." },
  { value: "loan_given", label: "Empréstimo dado", short: "Emprest." },
  { value: "loan_received", label: "Empréstimo recebido", short: "Recebido" },
];

const CHANNELS: {
  value: PaymentChannel;
  label: string;
  icon: React.ReactNode;
}[] = [
  { value: "card", label: "Cartão", icon: <CreditCard className="h-3.5 w-3.5" /> },
  { value: "pix", label: "PIX", icon: <QrCode className="h-3.5 w-3.5" /> },
  { value: "account", label: "Conta", icon: <Wallet className="h-3.5 w-3.5" /> },
  { value: "cash", label: "Dinheiro", icon: <Banknote className="h-3.5 w-3.5" /> },
];

const FIELD =
  "h-12 w-full rounded-[12px] border border-[var(--color-line)] bg-[var(--color-input)] px-3.5 text-[15px] text-[var(--color-text)] placeholder:text-[var(--color-text-3)] focus-visible:border-[var(--color-text)]/40 focus-visible:ring-2 focus-visible:ring-[var(--color-text)]/10";

function FieldLabel({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <Label className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-2)]">
      {children}
      {hint}
    </Label>
  );
}

function Chip({
  active,
  onClick,
  children,
  className,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-all active:scale-[0.97]",
        active
          ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-white dark:border-[#F2F2F7] dark:bg-[#F2F2F7] dark:text-[#111]"
          : "border-[var(--color-line)] bg-[var(--color-chip)] text-[var(--color-text-2)] hover:text-[var(--color-text)]",
        className
      )}
    >
      {children}
    </button>
  );
}

function MemberChip({
  name,
  color,
  active,
  onClick,
}: {
  name: string;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-full border px-3 text-[13px] font-medium transition-all active:scale-[0.97]",
        active
          ? "border-transparent text-white"
          : "border-[var(--color-line)] bg-[var(--color-chip)] text-[var(--color-text-2)] hover:text-[var(--color-text)]"
      )}
      style={active ? { backgroundColor: color } : undefined}
    >
      <span
        className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-medium text-white"
        style={{ backgroundColor: active ? "rgba(0,0,0,0.25)" : color }}
      >
        {name[0]}
      </span>
      {name}
    </button>
  );
}

export function TransactionFormDialog({
  member,
  trigger,
}: {
  member: WorkspaceMember;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [aiHint, setAiHint] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const qc = useQueryClient();

  const { data: cards = [] } = useCards(member.workspace_id);
  const { data: accounts = [] } = useAccounts(member.workspace_id);
  const { data: members = [] } = useWorkspaceMembers(member.workspace_id);

  const { data: categories = [] } = useQuery({
    queryKey: ["categories", member.workspace_id],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error: qError } = await supabase
        .from("categories")
        .select("*")
        .eq("workspace_id", member.workspace_id)
        .order("name");
      if (qError) throw qError;
      return data as Category[];
    },
  });

  const defaults = useMemo<TransactionInput>(
    () => ({
      description: "",
      amount: 0,
      transaction_type: "expense",
      transaction_date: toISODate(new Date()),
      category_id: null,
      paid_by_member_id: member.id,
      consumer_member_id: member.id,
      payment_method: "",
      payment_channel: "card",
      notes: "",
      is_installment: false,
      total_installments: 2,
      third_party_name: "",
      third_party_relationship: "",
      transfer_to_account_id: null,
    }),
    [member.id]
  );

  const form = useForm<TransactionInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(transactionSchema) as any,
    defaultValues: defaults,
  });

  const txType = form.watch("transaction_type");
  const isInstallment = form.watch("is_installment");
  const amount = form.watch("amount");
  const description = form.watch("description");
  const channel = form.watch("payment_channel") ?? "card";

  useEffect(() => {
    if (!open || txType !== "expense") return;
    if (!description || description.trim().length < 3) {
      setAiHint(null);
      return;
    }

    const handle = setTimeout(async () => {
      setAiLoading(true);
      try {
        const res = await fetch("/api/ai/categorize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description: description.trim(),
            amount,
            workspaceId: member.workspace_id,
          }),
        });
        if (res.status === 503) {
          setAiHint(null);
          return;
        }
        if (!res.ok) return;
        const data = (await res.json()) as {
          categoryId: string;
          categoryName: string;
          confidence: number;
        };
        if (data.categoryId && data.confidence >= 0.5) {
          form.setValue("category_id", data.categoryId);
          setAiHint(
            `IA: ${data.categoryName} (${Math.round(data.confidence * 100)}%)`
          );
        }
      } catch {
        // não bloqueia o formulário
      } finally {
        setAiLoading(false);
      }
    }, 700);

    return () => clearTimeout(handle);
  }, [description, amount, open, txType, member.workspace_id, form]);

  const filteredCategories = categories.filter((c) => {
    if (txType === "income" || txType === "loan_received") return c.type === "income";
    if (txType === "transfer") return true;
    return c.type === "expense";
  });

  const accountTypesForChannel: AccountType[] | undefined =
    channel === "pix"
      ? ["checking", "savings", "investment"]
      : channel === "cash"
        ? ["cash"]
        : channel === "account"
          ? ["checking", "savings", "investment", "cash"]
          : undefined;

  const paymentPlaceholder =
    channel === "pix"
      ? "Conta usada no PIX"
      : channel === "cash"
        ? "Carteira / dinheiro"
        : channel === "account"
          ? "Conta bancária"
          : "Escolha o cartão";

  const paymentEmptyHint =
    channel === "pix"
      ? "Cadastre uma conta corrente ou poupança para lançar PIX."
      : channel === "cash"
        ? "Cadastre uma conta do tipo Dinheiro."
        : channel === "card"
          ? "Cadastre um cartão para continuar."
          : "Cadastre uma conta para continuar.";

  function setChannel(next: PaymentChannel) {
    form.setValue("payment_channel", next);
    form.setValue("payment_method", "");
    if (next !== "card") {
      form.setValue("is_installment", false);
    }
  }

  function setType(next: TransactionInput["transaction_type"]) {
    form.setValue("transaction_type", next);
    form.setValue("payment_method", "");
    if (next === "transfer") {
      form.setValue("payment_channel", "account");
      form.setValue("is_installment", false);
    } else if (!form.getValues("payment_channel")) {
      form.setValue("payment_channel", "card");
    }
  }

  async function onSubmit(values: TransactionInput) {
    setSubmitting(true);
    setError(null);
    const result = await createTransactionAction(values);
    setSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    // Fecha na hora; atualiza listas em background
    setOpen(false);
    setAiHint(null);
    form.reset(defaults);
    invalidateFinanceQueries(qc);
  }

  const showPaymentChannels = txType !== "transfer";
  const showInstallment = txType === "expense" && channel === "card";

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setError(null);
          setAiHint(null);
        }
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" className="sm:h-10 sm:px-4">
            <Plus className="mr-1.5 h-4 w-4" />
            Novo
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        hideClose
        className="flex max-h-[min(94dvh,100%)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
      >
        {/* Handle + header */}
        <div className="shrink-0 border-b border-[var(--color-line)]">
          <div className="flex justify-center pb-1 pt-2.5 sm:hidden">
            <div className="h-1 w-10 rounded-full bg-[var(--color-line)]" />
          </div>
          <div className="flex items-start justify-between gap-3 px-5 pb-3.5 pt-1 sm:pt-5">
            <DialogHeader className="space-y-1 pr-8">
              <DialogTitle>Novo lançamento</DialogTitle>
              <p className="text-sm text-[var(--color-text-2)]">
                Gasto, receita ou transferência
              </p>
            </DialogHeader>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-chip)] text-[var(--color-text-2)] transition-colors hover:text-[var(--color-text)] sm:right-4 sm:top-4"
              aria-label="Fechar"
            >
              <span className="text-lg leading-none">×</span>
            </button>
          </div>
        </div>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:space-y-5 sm:px-5">
            {/* Tipo */}
            <div className="space-y-2">
              <FieldLabel>Tipo</FieldLabel>
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {TX_TYPES.map((t) => (
                  <Chip
                    key={t.value}
                    active={txType === t.value}
                    onClick={() => setType(t.value)}
                  >
                    {t.value === "transfer" && (
                      <ArrowLeftRight className="h-3.5 w-3.5" />
                    )}
                    {(t.value === "loan_given" ||
                      t.value === "loan_received") && (
                      <HandCoins className="h-3.5 w-3.5" />
                    )}
                    <span className="sm:hidden">{t.short}</span>
                    <span className="hidden sm:inline">{t.label}</span>
                  </Chip>
                ))}
              </div>
            </div>

            {/* Hero valor */}
            <div className="rounded-[16px] border border-[var(--color-line)] bg-[var(--color-chip)] p-4">
              <FieldLabel>Valor</FieldLabel>
              <MoneyInput
                value={amount}
                onValueChange={(v) =>
                  form.setValue("amount", v, { shouldValidate: true })
                }
                className="mt-1.5 h-[52px] rounded-xl border-0 bg-transparent pl-11 text-[28px] font-semibold leading-none tracking-tight text-[var(--color-text)] shadow-none focus-visible:ring-0"
              />
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <FieldLabel
                  hint={
                    (aiLoading || aiHint) && (
                      <span className="inline-flex items-center gap-1 normal-case tracking-normal text-[var(--color-text-2)]">
                        <Sparkles className="h-3 w-3" />
                        {aiLoading ? "sugerindo…" : aiHint}
                      </span>
                    )
                  }
                >
                  Descrição
                </FieldLabel>
                <Input
                  {...form.register("description")}
                  placeholder="Ex.: iFood, Uber, salário"
                  list="desc-suggestions"
                  autoComplete="off"
                  enterKeyHint="next"
                  className={FIELD}
                />
                <datalist id="desc-suggestions">
                  <option value="iFood" />
                  <option value="Uber" />
                  <option value="Mercado" />
                  <option value="Netflix" />
                  <option value="Aluguel" />
                  <option value="Salário" />
                </datalist>
              </div>

              <div className="space-y-1.5">
                <FieldLabel>Data</FieldLabel>
                <div className="relative">
                  <CalendarDays
                    size={16}
                    strokeWidth={1.75}
                    className="pointer-events-none absolute left-3.5 top-1/2 z-[1] -translate-y-1/2 text-[var(--color-text-2)]"
                  />
                  <Input
                    type="date"
                    {...form.register("transaction_date")}
                    className={cn(
                      FIELD,
                      "pl-10 pr-3 font-medium [color-scheme:light] dark:[color-scheme:dark]",
                      "[&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
                    )}
                  />
                </div>
              </div>
            </div>

            {showPaymentChannels && (
              <div className="space-y-2.5">
                <FieldLabel>Forma de pagamento</FieldLabel>
                <div className="grid grid-cols-4 gap-2">
                  {CHANNELS.map((c) => (
                    <Chip
                      key={c.value}
                      active={channel === c.value}
                      onClick={() => setChannel(c.value)}
                      className="h-auto min-h-[52px] w-full flex-col justify-center gap-1 rounded-[12px] px-1.5 py-2 text-[11px]"
                    >
                      {c.icon}
                      {c.label}
                    </Chip>
                  ))}
                </div>
                <CardSelector
                  cards={cards}
                  accounts={accounts}
                  cardsOnly={channel === "card"}
                  accountsOnly={channel !== "card"}
                  accountTypes={accountTypesForChannel}
                  value={form.watch("payment_method")}
                  onChange={(v) => form.setValue("payment_method", v)}
                  placeholder={paymentPlaceholder}
                  triggerClassName="h-12 rounded-[12px] border-[var(--color-line)] bg-[var(--color-input)]"
                />
                {!form.watch("payment_method") &&
                  ((channel === "card" && !cards.some((c) => c.is_active)) ||
                    (channel !== "card" &&
                      !accounts.some(
                        (a) =>
                          a.is_active &&
                          (!accountTypesForChannel ||
                            accountTypesForChannel.includes(a.account_type))
                      ))) && (
                    <p className="text-xs text-[var(--color-text-2)]">
                      {paymentEmptyHint}
                    </p>
                  )}
              </div>
            )}

            {txType === "transfer" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <FieldLabel>Conta de origem</FieldLabel>
                  <CardSelector
                    cards={cards}
                    accounts={accounts}
                    accountsOnly
                    value={form.watch("payment_method")}
                    onChange={(v) => form.setValue("payment_method", v)}
                    placeholder="De onde sai"
                    triggerClassName="h-12 rounded-[12px] border-[var(--color-line)] bg-[var(--color-input)]"
                  />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>Conta de destino</FieldLabel>
                  <Select
                    value={form.watch("transfer_to_account_id") ?? undefined}
                    onValueChange={(v) =>
                      form.setValue("transfer_to_account_id", v)
                    }
                  >
                    <SelectTrigger className="h-12 rounded-[12px] border-[var(--color-line)] bg-[var(--color-input)]">
                      <SelectValue placeholder="Para onde entra" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts
                        .filter((a) => a.is_active)
                        .map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {txType !== "transfer" && (
              <div className="space-y-1.5">
                <FieldLabel>Categoria</FieldLabel>
                <Select
                  value={form.watch("category_id") ?? undefined}
                  onValueChange={(v) => {
                    form.setValue("category_id", v);
                    setAiHint(null);
                  }}
                >
                  <SelectTrigger className="h-12 rounded-[12px] border-[var(--color-line)] bg-[var(--color-input)]">
                    <SelectValue placeholder="Escolha uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredCategories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.icon} {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-3 rounded-[16px] border border-[var(--color-line)] bg-[var(--color-chip)] p-3.5">
              <div className="space-y-2">
                <FieldLabel>Quem consumiu</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {members.map((m) => (
                    <MemberChip
                      key={`c-${m.id}`}
                      name={m.display_name}
                      color={m.avatar_color || "#c0c0c0"}
                      active={form.watch("consumer_member_id") === m.id}
                      onClick={() => form.setValue("consumer_member_id", m.id)}
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-2 border-t border-[var(--color-line)] pt-3">
                <FieldLabel>Quem pagou</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {members.map((m) => (
                    <MemberChip
                      key={`p-${m.id}`}
                      name={m.display_name}
                      color={m.avatar_color || "#c0c0c0"}
                      active={form.watch("paid_by_member_id") === m.id}
                      onClick={() => form.setValue("paid_by_member_id", m.id)}
                    />
                  ))}
                </div>
              </div>
            </div>

            {(txType === "loan_given" || txType === "loan_received") && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <FieldLabel>Terceiro</FieldLabel>
                  <Input
                    {...form.register("third_party_name")}
                    placeholder="Nome (ex: Pai)"
                    className="h-12 rounded-[12px] border-[var(--color-line)] bg-[var(--color-input)]"
                  />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>Relação</FieldLabel>
                  <Input
                    {...form.register("third_party_relationship")}
                    placeholder="pai, amigo…"
                    className="h-12 rounded-[12px] border-[var(--color-line)] bg-[var(--color-input)]"
                  />
                </div>
              </div>
            )}

            {showInstallment && (
              <div className="space-y-2 rounded-[16px] border border-[var(--color-line)] bg-[var(--color-chip)] p-3.5">
                <div className="flex items-center gap-2.5">
                  <Checkbox
                    checked={isInstallment}
                    onCheckedChange={(v) =>
                      form.setValue("is_installment", Boolean(v))
                    }
                    id="installment"
                  />
                  <Label
                    htmlFor="installment"
                    className="text-sm font-medium text-[var(--color-text)]"
                  >
                    Parcelado no cartão
                  </Label>
                </div>
                {isInstallment && (
                  <div className="space-y-1.5 pt-1">
                    <FieldLabel>Nº de parcelas</FieldLabel>
                    <IntegerMaskInput
                      min={2}
                      max={48}
                      value={form.watch("total_installments") ?? 2}
                      onValueChange={(v) =>
                        form.setValue("total_installments", v, {
                          shouldValidate: true,
                        })
                      }
                    />
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <FieldLabel>Notas</FieldLabel>
              <Textarea
                rows={2}
                {...form.register("notes")}
                placeholder="Opcional"
                className="min-h-[68px] resize-none rounded-[12px] border-[var(--color-line)] bg-[var(--color-input)]"
              />
            </div>

            {error && (
              <p className="rounded-[12px] bg-[#EF4444]/10 px-3 py-2.5 text-sm text-[#EF4444]">
                {error}
              </p>
            )}
          </div>

          <div className="shrink-0 border-t border-[var(--color-line)] bg-[var(--color-modal)] px-4 pt-3 pb-[max(0.85rem,env(safe-area-inset-bottom))] sm:px-5">
            <Btn type="submit" fullWidth size="lg" disabled={submitting}>
              {submitting ? "Salvando…" : "Salvar lançamento"}
            </Btn>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
