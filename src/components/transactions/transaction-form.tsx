"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  transactionSchema,
  type TransactionInput,
} from "@/lib/validations/transaction";
import { createTransactionAction } from "@/lib/actions/transactions";
import { MoneyInput } from "@/components/transactions/money-input";
import { CardSelector } from "@/components/transactions/card-selector";
import { useAccounts, useCards, useWorkspaceMembers } from "@/lib/hooks/use-finance";
import type { Category, WorkspaceMember } from "@/types";
import { toISODate } from "@/lib/utils/format";
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
import { Plus, Sparkles } from "lucide-react";

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

  const form = useForm<TransactionInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(transactionSchema) as any,
    defaultValues: {
      description: "",
      amount: 0,
      transaction_type: "expense",
      transaction_date: toISODate(new Date()),
      category_id: null,
      paid_by_member_id: member.id,
      consumer_member_id: member.id,
      payment_method: "",
      notes: "",
      is_installment: false,
      total_installments: 2,
      third_party_name: "",
      third_party_relationship: "",
      transfer_to_account_id: null,
    },
  });

  const txType = form.watch("transaction_type");
  const isInstallment = form.watch("is_installment");
  const amount = form.watch("amount");
  const description = form.watch("description");

  // Auto-categorização (silencioso se não houver API key)
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

  async function onSubmit(values: TransactionInput) {
    setSubmitting(true);
    setError(null);
    const result = await createTransactionAction(values);
    setSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    await Promise.all([
      qc.invalidateQueries({ queryKey: ["transactions"] }),
      qc.invalidateQueries({ queryKey: ["dashboard"] }),
      qc.invalidateQueries({ queryKey: ["invoices"] }),
    ]);
    setOpen(false);
    setAiHint(null);
    form.reset({
      description: "",
      amount: 0,
      transaction_type: "expense",
      transaction_date: toISODate(new Date()),
      category_id: null,
      paid_by_member_id: member.id,
      consumer_member_id: member.id,
      payment_method: "",
      notes: "",
      is_installment: false,
      total_installments: 2,
      third_party_name: "",
      third_party_relationship: "",
      transfer_to_account_id: null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" className="sm:h-10 sm:px-4">
            <Plus className="mr-1.5 h-4 w-4" />
            Novo
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo lançamento</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1">
            <Label>Tipo</Label>
            <Select
              value={txType}
              onValueChange={(v) =>
                form.setValue(
                  "transaction_type",
                  v as TransactionInput["transaction_type"]
                )
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">Despesa</SelectItem>
                <SelectItem value="income">Receita</SelectItem>
                <SelectItem value="transfer">Transferência</SelectItem>
                <SelectItem value="loan_given">Empréstimo dado</SelectItem>
                <SelectItem value="loan_received">Empréstimo recebido</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="flex flex-wrap items-center gap-1.5">
              Descrição
              {(aiLoading || aiHint) && (
                <span className="inline-flex items-center gap-1 text-[10px] font-normal text-primary">
                  <Sparkles className="h-3 w-3" />
                  {aiLoading ? "sugerindo…" : aiHint}
                </span>
              )}
            </Label>
            <Input
              {...form.register("description")}
              placeholder="iFood, Uber, salário…"
              list="desc-suggestions"
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Valor</Label>
              <MoneyInput
                value={amount}
                onValueChange={(v) =>
                  form.setValue("amount", v, { shouldValidate: true })
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Data</Label>
              <Input type="date" {...form.register("transaction_date")} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>
              {txType === "transfer" ? "Conta de origem" : "Cartão / Conta"}
            </Label>
            <CardSelector
              cards={cards}
              accounts={accounts}
              accountsOnly={txType === "transfer"}
              value={form.watch("payment_method")}
              onChange={(v) => form.setValue("payment_method", v)}
            />
          </div>

          {txType === "transfer" && (
            <div className="space-y-1">
              <Label>Conta de destino</Label>
              <Select
                value={form.watch("transfer_to_account_id") ?? undefined}
                onValueChange={(v) => form.setValue("transfer_to_account_id", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Destino" />
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
          )}

          {txType !== "transfer" && (
            <div className="space-y-1">
              <Label>Categoria</Label>
              <Select
                value={form.watch("category_id") ?? undefined}
                onValueChange={(v) => {
                  form.setValue("category_id", v);
                  setAiHint(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Categoria" />
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

          <div className="space-y-1">
            <Label>Quem consumiu</Label>
            <div className="flex flex-wrap gap-2">
              {members.map((m) => (
                <Button
                  key={`c-${m.id}`}
                  type="button"
                  size="sm"
                  variant={
                    form.watch("consumer_member_id") === m.id
                      ? "default"
                      : "outline"
                  }
                  onClick={() => form.setValue("consumer_member_id", m.id)}
                >
                  {m.display_name}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <Label>Quem pagou</Label>
            <div className="flex flex-wrap gap-2">
              {members.map((m) => (
                <Button
                  key={`p-${m.id}`}
                  type="button"
                  size="sm"
                  variant={
                    form.watch("paid_by_member_id") === m.id
                      ? "default"
                      : "outline"
                  }
                  onClick={() => form.setValue("paid_by_member_id", m.id)}
                >
                  {m.display_name}
                </Button>
              ))}
            </div>
          </div>

          {(txType === "loan_given" || txType === "loan_received") && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Terceiro</Label>
                <Input
                  {...form.register("third_party_name")}
                  placeholder="Nome (ex: Pai)"
                />
              </div>
              <div className="space-y-1">
                <Label>Relação</Label>
                <Input
                  {...form.register("third_party_relationship")}
                  placeholder="pai, amigo…"
                />
              </div>
            </div>
          )}

          {txType === "expense" && (
            <div className="space-y-2 rounded-lg border border-border/60 p-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={isInstallment}
                  onCheckedChange={(v) =>
                    form.setValue("is_installment", Boolean(v))
                  }
                  id="installment"
                />
                <Label htmlFor="installment">Parcelado</Label>
              </div>
              {isInstallment && (
                <div className="space-y-1">
                  <Label>Nº de parcelas</Label>
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

          <div className="space-y-1">
            <Label>Notas</Label>
            <Textarea rows={2} {...form.register("notes")} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Salvando…" : "Salvar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
