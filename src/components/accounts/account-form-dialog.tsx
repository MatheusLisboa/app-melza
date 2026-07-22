"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BANKS, getBankColor } from "@/lib/utils/banks";
import { accountSchema, type AccountInput } from "@/lib/validations/card";
import type { Account, WorkspaceMember } from "@/types";
import { Btn } from "@/components/design-system";
import { MoneyInput } from "@/components/transactions/money-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { cn } from "@/lib/utils";
import { Banknote, Landmark, PiggyBank, Plus, TrendingUp } from "lucide-react";

const TYPES: {
  value: AccountInput["account_type"];
  label: string;
  icon: typeof Landmark;
}[] = [
  { value: "checking", label: "Corrente", icon: Landmark },
  { value: "savings", label: "Poupança", icon: PiggyBank },
  { value: "cash", label: "Dinheiro", icon: Banknote },
  { value: "investment", label: "Invest.", icon: TrendingUp },
];

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
      {children}
    </Label>
  );
}

export function AccountFormDialog({
  members,
  onSubmit,
  trigger,
  initial,
}: {
  members: WorkspaceMember[];
  onSubmit: (values: AccountInput) => Promise<void>;
  trigger?: React.ReactNode;
  initial?: Account | null;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEdit = Boolean(initial);

  const form = useForm<AccountInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(accountSchema) as any,
    defaultValues: {
      name: "",
      account_type: "checking",
      bank: "nubank",
      color: getBankColor("nubank"),
      owner_member_id: members[0]?.id ?? null,
      current_balance: 0,
      is_shared: true,
    },
  });

  useEffect(() => {
    if (!open) return;
    if (initial) {
      form.reset({
        name: initial.name,
        account_type: initial.account_type,
        bank: initial.bank ?? "other",
        color: initial.color ?? getBankColor("other"),
        owner_member_id: initial.owner_member_id,
        current_balance: Number(initial.current_balance ?? 0),
        is_shared: initial.is_shared !== false,
      });
    } else {
      form.reset({
        name: "",
        account_type: "checking",
        bank: "nubank",
        color: getBankColor("nubank"),
        owner_member_id: members[0]?.id ?? null,
        current_balance: 0,
        is_shared: true,
      });
    }
    setError(null);
  }, [open, initial, members, form]);

  const bank = form.watch("bank") ?? "nubank";
  const accountType = form.watch("account_type");

  useEffect(() => {
    if (!isEdit) form.setValue("color", getBankColor(bank));
  }, [bank, form, isEdit]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Btn size="sm" icon={<Plus className="h-4 w-4" />}>
            Nova conta
          </Btn>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] gap-0 overflow-hidden border-border/60 bg-card p-0 sm:max-w-md sm:rounded-2xl">
        <DialogHeader className="border-b border-border/50 px-5 pb-4 pt-5 text-left">
          <DialogTitle className="text-[17px] font-semibold tracking-tight">
            {isEdit ? "Editar conta" : "Nova conta"}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {isEdit
              ? "Ajuste saldo e dados da conta"
              : "Corrente, poupança, dinheiro ou investimento"}
          </p>
        </DialogHeader>

        <form
          className="max-h-[min(78vh,640px)] space-y-4 overflow-y-auto px-5 py-5"
          onSubmit={form.handleSubmit(async (values) => {
            setSubmitting(true);
            setError(null);
            try {
              await onSubmit({
                ...values,
                current_balance: values.current_balance ?? 0,
              });
              setOpen(false);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Falha ao salvar");
            } finally {
              setSubmitting(false);
            }
          })}
        >
          <div className="space-y-2">
            <FieldLabel>Tipo</FieldLabel>
            <div className="grid grid-cols-4 gap-2">
              {TYPES.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => form.setValue("account_type", value)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl border px-1 py-2.5 text-[11px] font-medium transition-all active:scale-[0.97]",
                    accountType === value
                      ? "border-primary/40 bg-primary text-primary-foreground"
                      : "border-border/70 bg-muted/30 text-muted-foreground hover:bg-muted/55"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border/50 bg-muted/25 px-4 py-4">
            <FieldLabel>Saldo atual</FieldLabel>
            <MoneyInput
              value={Number(form.watch("current_balance") ?? 0)}
              onValueChange={(v) => form.setValue("current_balance", v)}
              className="mt-2 h-14 rounded-xl border-0 bg-transparent pl-11 text-2xl font-semibold tracking-tight shadow-none focus-visible:ring-0"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Valor disponível nesta conta agora
            </p>
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Nome</FieldLabel>
            <Input
              {...form.register("name")}
              placeholder="Nubank Conta"
              className="h-11 rounded-xl"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <FieldLabel>Banco</FieldLabel>
              <Select
                value={form.watch("bank") ?? "other"}
                onValueChange={(v) => form.setValue("bank", v)}
              >
                <SelectTrigger className="h-11 rounded-xl">
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
            <div className="space-y-1.5">
              <FieldLabel>Dono</FieldLabel>
              <Select
                value={form.watch("owner_member_id") ?? undefined}
                onValueChange={(v) => form.setValue("owner_member_id", v)}
              >
                <SelectTrigger className="h-11 rounded-xl">
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
            <div className="space-y-2">
              <FieldLabel>Tipo de conta</FieldLabel>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => form.setValue("is_shared", true)}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-left text-[13px] transition-colors",
                    form.watch("is_shared") !== false
                      ? "border-[#111111] bg-[#111111] text-white"
                      : "border-[#E5E5EA] bg-white text-[#111111]"
                  )}
                >
                  <span className="block font-medium">Compartilhada</span>
                  <span className="mt-0.5 block text-[11px] opacity-70">
                    Do workspace
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => form.setValue("is_shared", false)}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-left text-[13px] transition-colors",
                    form.watch("is_shared") === false
                      ? "border-[#111111] bg-[#111111] text-white"
                      : "border-[#E5E5EA] bg-white text-[#111111]"
                  )}
                >
                  <span className="block font-medium">Pessoal</span>
                  <span className="mt-0.5 block text-[11px] opacity-70">
                    Só do dono
                  </span>
                </button>
              </div>
            </div>
          </div>

          {error && (
            <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <Btn type="submit" fullWidth size="lg" disabled={submitting}>
            {submitting
              ? "Salvando…"
              : isEdit
                ? "Salvar alterações"
                : "Criar conta"}
          </Btn>
        </form>
      </DialogContent>
    </Dialog>
  );
}
