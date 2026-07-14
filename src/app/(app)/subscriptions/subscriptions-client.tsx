"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, differenceInCalendarDays, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { useCards, useAccounts } from "@/lib/hooks/use-finance";
import {
  createSubscriptionAction,
  paySubscriptionAction,
  toggleSubscriptionAction,
} from "@/lib/actions/subscriptions-loans";
import {
  subscriptionSchema,
  type SubscriptionInput,
} from "@/lib/validations/subscriptions-loans";
import type { Category, WorkspaceMember, Subscription } from "@/types";
import { formatCurrency, formatDate, toISODate } from "@/lib/utils/format";
import { useUiStore } from "@/lib/stores/ui-store";
import { MoneyInput } from "@/components/transactions/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { AlertTriangle, Check, Plus } from "lucide-react";

function monthlyEquivalent(sub: Subscription): number {
  const amount = Number(sub.amount);
  if (sub.billing_cycle === "yearly") return amount / 12;
  if (sub.billing_cycle === "weekly") return (amount * 52) / 12;
  return amount;
}

export function SubscriptionsClient({ member }: { member: WorkspaceMember }) {
  const qc = useQueryClient();
  const alertDays = useUiStore((s) => s.subscriptionAlertDays);
  const { data: cards = [] } = useCards(member.workspace_id);
  const { data: accounts = [] } = useAccounts(member.workspace_id);

  const { data: categories = [] } = useQuery({
    queryKey: ["categories", member.workspace_id],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("workspace_id", member.workspace_id);
      if (error) throw error;
      return data as Category[];
    },
  });

  const { data: subscriptions = [], isLoading } = useQuery({
    queryKey: ["subscriptions", member.workspace_id],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("workspace_id", member.workspace_id)
        .order("next_billing_date", { ascending: true });
      if (error) throw error;
      return data as Subscription[];
    },
  });

  const active = subscriptions.filter((s) => s.is_active);
  const monthlyTotal = useMemo(
    () => active.reduce((sum, s) => sum + monthlyEquivalent(s), 0),
    [active]
  );

  const dueSoon = useMemo(() => {
    const limit = addDays(new Date(), alertDays);
    return active.filter((s) => {
      if (!s.next_billing_date) return false;
      const d = parseISO(s.next_billing_date);
      return d <= limit;
    });
  }, [active, alertDays]);

  return (
    <div className="page-pad space-y-5 md:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[17px] font-semibold tracking-tight text-foreground/95">
            Assinaturas
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Total mensal estimado:{" "}
            <span className="font-money text-foreground">
              {formatCurrency(monthlyTotal)}
            </span>
          </p>
        </div>
        <SubscriptionFormDialog
          cards={cards}
          accounts={accounts}
          categories={categories}
          onCreated={async () => {
            await qc.invalidateQueries({ queryKey: ["subscriptions"] });
          }}
        />
      </div>

      {dueSoon.length > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              Vencem em até {alertDays} dias ({dueSoon.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {dueSoon.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between text-sm"
              >
                <span>{s.name}</span>
                <span className="font-money">
                  {s.next_billing_date
                    ? formatDate(s.next_billing_date)
                    : "—"}{" "}
                  · {formatCurrency(Number(s.amount))}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : subscriptions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma assinatura cadastrada.
        </p>
      ) : (
        <ul className="space-y-3">
          {subscriptions.map((sub) => {
            const daysLeft = sub.next_billing_date
              ? differenceInCalendarDays(
                  parseISO(sub.next_billing_date),
                  new Date()
                )
              : null;
            const card = cards.find((c) => c.id === sub.card_id);
            const account = accounts.find((a) => a.id === sub.account_id);

            return (
              <li
                key={sub.id}
                className="rounded-xl border border-border/60 bg-card/50 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{sub.name}</p>
                      {!sub.is_active && (
                        <Badge variant="outline">Inativa</Badge>
                      )}
                      {daysLeft != null && daysLeft >= 0 && daysLeft <= alertDays && (
                        <Badge className="bg-amber-500/15 text-amber-600 hover:bg-amber-500/15 dark:text-amber-400">
                          em {daysLeft}d
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground capitalize">
                      {sub.billing_cycle === "monthly"
                        ? "Mensal"
                        : sub.billing_cycle === "yearly"
                          ? "Anual"
                          : "Semanal"}
                      {card ? ` · ${card.name}` : ""}
                      {account ? ` · ${account.name}` : ""}
                      {sub.next_billing_date
                        ? ` · próxima: ${formatDate(sub.next_billing_date)}`
                        : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-money text-base font-semibold">
                      {formatCurrency(Number(sub.amount))}
                    </p>
                    <div className="mt-1 flex flex-col items-end gap-1">
                      {sub.is_active && (
                        <Button
                          size="sm"
                          className="h-8 px-2.5 text-xs"
                          onClick={async () => {
                            const res = await paySubscriptionAction(sub.id);
                            if (res.error) {
                              alert(res.error);
                              return;
                            }
                            await qc.invalidateQueries({
                              queryKey: ["subscriptions"],
                            });
                            await qc.invalidateQueries({
                              queryKey: ["transactions"],
                            });
                            await qc.invalidateQueries({
                              queryKey: ["dashboard"],
                            });
                          }}
                        >
                          <Check className="mr-1 h-3.5 w-3.5" />
                          Marcar como pago
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs"
                        onClick={async () => {
                          await toggleSubscriptionAction(
                            sub.id,
                            !sub.is_active
                          );
                          await qc.invalidateQueries({
                            queryKey: ["subscriptions"],
                          });
                        }}
                      >
                        {sub.is_active ? "Desativar" : "Reativar"}
                      </Button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function SubscriptionFormDialog({
  cards,
  accounts,
  categories,
  onCreated,
}: {
  cards: { id: string; name: string; is_active: boolean }[];
  accounts: { id: string; name: string; is_active: boolean }[];
  categories: Category[];
  onCreated: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<SubscriptionInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(subscriptionSchema) as any,
    defaultValues: {
      name: "",
      amount: 0,
      billing_cycle: "monthly",
      next_billing_date: toISODate(new Date()),
      card_id: null,
      account_id: null,
      category_id: null,
      notes: "",
    },
  });

  const amount = form.watch("amount");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="sm:size-default">
          <Plus className="mr-1.5 h-4 w-4" />
          Nova
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova assinatura</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={form.handleSubmit(async (values) => {
            setSubmitting(true);
            setError(null);
            const result = await createSubscriptionAction(values);
            setSubmitting(false);
            if (result.error) {
              setError(result.error);
              return;
            }
            await onCreated();
            setOpen(false);
            form.reset();
          })}
        >
          <div className="space-y-1">
            <Label>Nome</Label>
            <Input {...form.register("name")} placeholder="Netflix, Spotify…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Valor</Label>
              <MoneyInput
                value={amount}
                onValueChange={(v) => form.setValue("amount", v)}
              />
            </div>
            <div className="space-y-1">
              <Label>Ciclo</Label>
              <Select
                value={form.watch("billing_cycle")}
                onValueChange={(v) =>
                  form.setValue(
                    "billing_cycle",
                    v as SubscriptionInput["billing_cycle"]
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Mensal</SelectItem>
                  <SelectItem value="yearly">Anual</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Próxima cobrança</Label>
            <Input type="date" {...form.register("next_billing_date")} />
          </div>
          <div className="space-y-1">
            <Label>Cartão (opcional)</Label>
            <Select
              value={form.watch("card_id") ?? "none"}
              onValueChange={(v) =>
                form.setValue("card_id", v === "none" ? null : v)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Cartão" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {cards
                  .filter((c) => c.is_active)
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Conta (opcional)</Label>
            <Select
              value={form.watch("account_id") ?? "none"}
              onValueChange={(v) =>
                form.setValue("account_id", v === "none" ? null : v)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma</SelectItem>
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
          <div className="space-y-1">
            <Label>Categoria</Label>
            <Select
              value={form.watch("category_id") ?? "none"}
              onValueChange={(v) =>
                form.setValue("category_id", v === "none" ? null : v)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma</SelectItem>
                {categories
                  .filter((c) => c.type === "expense")
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.icon} {c.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
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
