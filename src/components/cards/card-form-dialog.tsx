"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BANKS, getBankColor } from "@/lib/utils/banks";
import { cardSchema, type CardInput } from "@/lib/validations/card";
import type { Card, WorkspaceMember } from "@/types";
import { Btn } from "@/components/design-system";
import { MoneyInput } from "@/components/transactions/money-input";
import {
  DayOfMonthInput,
  DigitMaskInput,
} from "@/components/shared/masked-input";
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
import { CreditCard, Plus } from "lucide-react";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
      {children}
    </Label>
  );
}

function TypeChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border text-[13px] font-medium transition-all active:scale-[0.97]",
        active
          ? "border-primary/40 bg-primary text-primary-foreground"
          : "border-border/70 bg-muted/30 text-muted-foreground hover:bg-muted/55"
      )}
    >
      {children}
    </button>
  );
}

export function CardFormDialog({
  members,
  onSubmit,
  trigger,
  initial,
  open: controlledOpen,
  onOpenChange,
}: {
  members: WorkspaceMember[];
  onSubmit: (values: CardInput) => Promise<void>;
  trigger?: React.ReactNode;
  initial?: Card | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = (v: boolean) => {
    onOpenChange?.(v);
    if (!isControlled) setUncontrolledOpen(v);
  };
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEdit = Boolean(initial);

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
    if (!open) return;
    if (initial) {
      form.reset({
        name: initial.name,
        bank: initial.bank,
        card_type: initial.card_type,
        color: initial.color,
        last_four: initial.last_four ?? "",
        owner_member_id: initial.owner_member_id,
        closing_day: initial.closing_day,
        due_day: initial.due_day,
        credit_limit: initial.credit_limit,
      });
    } else {
      form.reset({
        name: "",
        bank: "nubank",
        card_type: "credit",
        color: getBankColor("nubank"),
        last_four: "",
        owner_member_id: members[0]?.id ?? null,
        closing_day: 1,
        due_day: 10,
        credit_limit: null,
      });
    }
    setError(null);
  }, [open, initial, members, form]);

  const bank = form.watch("bank");
  const cardType = form.watch("card_type");

  useEffect(() => {
    if (!isEdit) form.setValue("color", getBankColor(bank));
  }, [bank, form, isEdit]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Btn size="sm" icon={<Plus className="h-4 w-4" />}>
            Novo cartão
          </Btn>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] gap-0 overflow-hidden border-border/60 bg-card p-0 sm:max-w-md sm:rounded-2xl">
        <DialogHeader className="border-b border-border/50 px-5 pb-4 pt-5 text-left">
          <DialogTitle className="text-[17px] font-semibold tracking-tight">
            {isEdit ? "Editar cartão" : "Novo cartão"}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {isEdit
              ? "Atualize limite, ciclos e dados do cartão"
              : "Cadastre crédito ou débito do workspace"}
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
                last_four: values.last_four || null,
                credit_limit:
                  values.credit_limit != null && values.credit_limit > 0
                    ? values.credit_limit
                    : null,
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
            <div className="flex gap-2">
              <TypeChip
                active={cardType === "credit"}
                onClick={() => form.setValue("card_type", "credit")}
              >
                <CreditCard className="h-3.5 w-3.5" />
                Crédito
              </TypeChip>
              <TypeChip
                active={cardType === "debit"}
                onClick={() => form.setValue("card_type", "debit")}
              >
                Débito
              </TypeChip>
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Nome</FieldLabel>
            <Input
              {...form.register("name")}
              placeholder="Nubank Matheus"
              className="h-11 rounded-xl"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <FieldLabel>Banco</FieldLabel>
              <Select
                value={form.watch("bank")}
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
              <FieldLabel>Final</FieldLabel>
              <DigitMaskInput
                maxLength={4}
                placeholder="1234"
                value={form.watch("last_four") ?? ""}
                onValueChange={(v) => form.setValue("last_four", v)}
                className="h-11 rounded-xl"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Dono</FieldLabel>
            <Select
              value={form.watch("owner_member_id") ?? undefined}
              onValueChange={(v) => form.setValue("owner_member_id", v)}
            >
              <SelectTrigger className="h-11 rounded-xl">
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

          {cardType === "credit" && (
            <div className="space-y-3 rounded-2xl border border-border/50 bg-muted/20 p-3.5">
              <div className="space-y-1.5">
                <FieldLabel>Limite</FieldLabel>
                <MoneyInput
                  value={Number(form.watch("credit_limit") ?? 0)}
                  onValueChange={(v) =>
                    form.setValue("credit_limit", v > 0 ? v : null)
                  }
                  className="h-12 rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <FieldLabel>Fecha dia</FieldLabel>
                  <DayOfMonthInput
                    placeholder="15"
                    value={form.watch("closing_day")}
                    onValueChange={(v) =>
                      form.setValue("closing_day", v ?? null)
                    }
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>Vence dia</FieldLabel>
                  <DayOfMonthInput
                    placeholder="22"
                    value={form.watch("due_day")}
                    onValueChange={(v) => form.setValue("due_day", v ?? null)}
                    className="h-11 rounded-xl"
                  />
                </div>
              </div>
            </div>
          )}

          {error && (
            <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <Btn type="submit" fullWidth size="lg" disabled={submitting}>
            {submitting ? "Salvando…" : isEdit ? "Salvar alterações" : "Criar cartão"}
          </Btn>
        </form>
      </DialogContent>
    </Dialog>
  );
}
