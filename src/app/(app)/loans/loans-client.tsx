"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAccounts, useCards } from "@/lib/hooks/use-finance";
import {
  createLoanAction,
  repayLoanAction,
} from "@/lib/actions/subscriptions-loans";
import {
  loanRepaymentSchema,
  loanSchema,
  type LoanInput,
  type LoanRepaymentInput,
} from "@/lib/validations/subscriptions-loans";
import type { WorkspaceMember, Loan, ThirdParty } from "@/types";
import { formatCurrency, formatDate, toISODate } from "@/lib/utils/format";
import { MoneyInput } from "@/components/transactions/money-input";
import { CardSelector } from "@/components/transactions/card-selector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus } from "lucide-react";

type LoanRow = Loan & { third_party?: ThirdParty | null };

const STATUS_LABEL: Record<string, string> = {
  open: "Em aberto",
  partial: "Parcial",
  paid: "Quitado",
  cancelled: "Cancelado",
};

export function LoansClient({ member }: { member: WorkspaceMember }) {
  const qc = useQueryClient();
  const { data: cards = [] } = useCards(member.workspace_id);
  const { data: accounts = [] } = useAccounts(member.workspace_id);

  const { data: loans = [], isLoading } = useQuery({
    queryKey: ["loans", member.workspace_id],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("loans")
        .select("*, third_party:third_parties(*)")
        .eq("workspace_id", member.workspace_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as LoanRow[];
    },
  });

  const openLoans = loans.filter((l) => l.status === "open" || l.status === "partial");
  const theyOwe = useMemo(
    () =>
      openLoans
        .filter((l) => l.direction === "given")
        .reduce(
          (s, l) => s + (Number(l.original_amount) - Number(l.paid_amount)),
          0
        ),
    [openLoans]
  );
  const weOwe = useMemo(
    () =>
      openLoans
        .filter((l) => l.direction === "received")
        .reduce(
          (s, l) => s + (Number(l.original_amount) - Number(l.paid_amount)),
          0
        ),
    [openLoans]
  );

  return (
    <div className="page-pad space-y-5 md:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[17px] font-semibold tracking-tight text-foreground/95">
            Empréstimos
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Controle com terceiros
          </p>
        </div>
        <LoanFormDialog
          cards={cards}
          accounts={accounts}
          onCreated={async () => {
            await qc.invalidateQueries({ queryKey: ["loans"] });
            await qc.invalidateQueries({ queryKey: ["dashboard"] });
          }}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card className="border-border/60 bg-card/50">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Nos devem
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-money text-lg font-semibold text-amber-500 sm:text-xl">
              {formatCurrency(theyOwe)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/50">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Devemos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-money text-lg font-semibold text-red-400 sm:text-xl">
              {formatCurrency(weOwe)}
            </p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : loans.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum empréstimo.</p>
      ) : (
        <ul className="space-y-3">
          {loans.map((loan) => {
            const remaining =
              Number(loan.original_amount) - Number(loan.paid_amount);
            return (
              <li
                key={loan.id}
                className="rounded-xl border border-border/60 bg-card/50 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">
                        {loan.third_party?.name ?? "Terceiro"}
                      </p>
                      <Badge
                        variant="secondary"
                        className={
                          loan.direction === "given"
                            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                            : "bg-red-500/15 text-red-400"
                        }
                      >
                        {loan.direction === "given" ? "Dado" : "Recebido"}
                      </Badge>
                      <Badge variant="outline">
                        {STATUS_LABEL[loan.status] ?? loan.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {loan.description || "Sem descrição"}
                      {loan.due_date ? ` · vence ${formatDate(loan.due_date)}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Original {formatCurrency(Number(loan.original_amount))} ·
                      pago {formatCurrency(Number(loan.paid_amount))}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-money text-base font-semibold">
                      {formatCurrency(remaining)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">saldo</p>
                    {(loan.status === "open" || loan.status === "partial") && (
                      <RepayDialog
                        loan={loan}
                        remaining={remaining}
                        cards={cards}
                        accounts={accounts}
                        onDone={async () => {
                          await qc.invalidateQueries({ queryKey: ["loans"] });
                          await qc.invalidateQueries({
                            queryKey: ["dashboard"],
                          });
                        }}
                      />
                    )}
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

function LoanFormDialog({
  cards,
  accounts,
  onCreated,
}: {
  cards: { id: string; name: string; is_active: boolean; color: string }[];
  accounts: {
    id: string;
    name: string;
    is_active: boolean;
    color: string | null;
  }[];
  onCreated: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<LoanInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(loanSchema) as any,
    defaultValues: {
      direction: "given",
      third_party_name: "",
      third_party_relationship: "",
      original_amount: 0,
      description: "",
      due_date: null,
      payment_method: null,
    },
  });

  const amount = form.watch("original_amount");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          Novo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo empréstimo</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={form.handleSubmit(async (values) => {
            setSubmitting(true);
            setError(null);
            const result = await createLoanAction(values);
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
            <Label>Direção</Label>
            <Select
              value={form.watch("direction")}
              onValueChange={(v) =>
                form.setValue("direction", v as "given" | "received")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="given">Emprestamos (nos devem)</SelectItem>
                <SelectItem value="received">Nos emprestaram (devemos)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Terceiro</Label>
              <Input {...form.register("third_party_name")} placeholder="Pai" />
            </div>
            <div className="space-y-1">
              <Label>Relação</Label>
              <Input
                {...form.register("third_party_relationship")}
                placeholder="pai, amigo…"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Valor</Label>
            <MoneyInput
              value={amount}
              onValueChange={(v) => form.setValue("original_amount", v)}
            />
          </div>
          <div className="space-y-1">
            <Label>Descrição</Label>
            <Input {...form.register("description")} />
          </div>
          <div className="space-y-1">
            <Label>Vencimento</Label>
            <Input type="date" {...form.register("due_date")} />
          </div>
          <div className="space-y-1">
            <Label>Cartão/conta (opcional — gera lançamento)</Label>
            <CardSelector
              cards={cards as never}
              accounts={accounts as never}
              value={form.watch("payment_method") ?? undefined}
              onChange={(v) => form.setValue("payment_method", v)}
            />
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

function RepayDialog({
  loan,
  remaining,
  cards,
  accounts,
  onDone,
}: {
  loan: LoanRow;
  remaining: number;
  cards: { id: string; name: string; is_active: boolean; color: string }[];
  accounts: {
    id: string;
    name: string;
    is_active: boolean;
    color: string | null;
  }[];
  onDone: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<LoanRepaymentInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(loanRepaymentSchema) as any,
    defaultValues: {
      loan_id: loan.id,
      amount: remaining,
      payment_method: "",
      transaction_date: toISODate(new Date()),
      notes: "",
    },
  });

  const amount = form.watch("amount");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="mt-2 h-8">
          Registrar pagamento
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pagamento — {loan.third_party?.name}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={form.handleSubmit(async (values) => {
            setSubmitting(true);
            setError(null);
            const result = await repayLoanAction(values);
            setSubmitting(false);
            if (result.error) {
              setError(result.error);
              return;
            }
            await onDone();
            setOpen(false);
          })}
        >
          <div className="space-y-1">
            <Label>Valor (saldo {formatCurrency(remaining)})</Label>
            <MoneyInput
              value={amount}
              onValueChange={(v) => form.setValue("amount", v)}
            />
          </div>
          <div className="space-y-1">
            <Label>Meio de pagamento</Label>
            <CardSelector
              cards={cards as never}
              accounts={accounts as never}
              value={form.watch("payment_method")}
              onChange={(v) => form.setValue("payment_method", v)}
            />
          </div>
          <div className="space-y-1">
            <Label>Data</Label>
            <Input type="date" {...form.register("transaction_date")} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Salvando…" : "Confirmar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
