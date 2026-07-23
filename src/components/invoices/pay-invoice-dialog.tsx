"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { payInvoiceAction } from "@/lib/actions/invoices";
import { invalidateFinanceQueries } from "@/lib/finance/invalidate";
import { useAccounts } from "@/lib/hooks/use-finance";
import { formatCurrency, toISODate } from "@/lib/utils/format";
import { MoneyInput } from "@/components/transactions/money-input";
import { Btn } from "@/components/design-system";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { WorkspaceMember } from "@/types";
import {
  InvoiceSettlementSuggestDialog,
  computeInvoiceOwedToCardOwner,
} from "@/components/invoices/invoice-settlement-suggest";

export function PayInvoiceDialog({
  open,
  onOpenChange,
  member,
  cardId,
  cardName,
  cardOwnerMemberId,
  cycleKey,
  cycleFrom,
  cycleTo,
  invoiceTotal,
  alreadyPaid,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: WorkspaceMember;
  cardId: string;
  cardName: string;
  cardOwnerMemberId?: string | null;
  cycleKey: string;
  cycleFrom: string;
  cycleTo: string;
  invoiceTotal: number;
  alreadyPaid: number;
}) {
  const qc = useQueryClient();
  const { data: accounts = [] } = useAccounts(member.workspace_id);
  const activeAccounts = useMemo(
    () => accounts.filter((a) => a.is_active),
    [accounts]
  );

  const remaining = Math.max(0, invoiceTotal - alreadyPaid);
  const [amount, setAmount] = useState(remaining);
  const [accountId, setAccountId] = useState("");
  const [paymentDate, setPaymentDate] = useState(toISODate(new Date()));
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [owedAmount, setOwedAmount] = useState(0);

  const fullTarget = remaining > 0 ? remaining : invoiceTotal;
  const halfTarget =
    remaining > 0
      ? Math.round((remaining / 2) * 100) / 100
      : Math.round((invoiceTotal / 2) * 100) / 100;

  const preset: "full" | "half" | "custom" =
    Math.abs(amount - fullTarget) < 0.005
      ? "full"
      : Math.abs(amount - halfTarget) < 0.005
        ? "half"
        : "custom";

  useEffect(() => {
    if (!open) return;
    setAmount(remaining > 0 ? remaining : invoiceTotal);
    setPaymentDate(toISODate(new Date()));
    setNotes("");
    setError(null);
    setAccountId((prev) => prev || activeAccounts[0]?.id || "");
  }, [open, remaining, invoiceTotal, activeAccounts]);

  async function onSubmit() {
    if (!accountId) {
      const msg = "Selecione a conta de pagamento";
      setError(msg);
      toast.error(msg);
      return;
    }
    if (!(amount > 0)) {
      const msg = "Informe um valor válido";
      setError(msg);
      toast.error(msg);
      return;
    }
    setBusy(true);
    setError(null);
    const res = await payInvoiceAction({
      cardId,
      accountId,
      amount,
      cycleKey,
      cycleFrom,
      cycleTo,
      cardName,
      paymentDate,
      notes: notes.trim() || undefined,
    });
    setBusy(false);
    if (res.error) {
      setError(res.error);
      toast.error(res.error);
      return;
    }
    toast.success(`Pagamento de ${formatCurrency(amount)} registrado`);
    invalidateFinanceQueries(qc);
    onOpenChange(false);

    // Sugere Entre Nós se a fatura tem gastos seus no cartão de outra pessoa
    if (
      cardOwnerMemberId &&
      cardOwnerMemberId !== member.id
    ) {
      try {
        const owed = await computeInvoiceOwedToCardOwner({
          workspaceId: member.workspace_id,
          cardId,
          cardOwnerMemberId,
          consumerMemberId: member.id,
          cycleFrom,
          cycleTo,
        });
        if (owed >= 1) {
          setOwedAmount(owed);
          setSuggestOpen(true);
        }
      } catch {
        /* ignore suggest errors */
      }
    }
  }

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader className="border-b border-[var(--color-fog)]">
            <DrawerTitle>Pagar fatura</DrawerTitle>
            <DrawerDescription className="truncate">
              {cardName} · ciclo {cycleKey}
            </DrawerDescription>
          </DrawerHeader>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
            <div className="rounded-2xl bg-[var(--color-ink)] px-4 py-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-mist)]">
                Restante a pagar
              </p>
              <p className="mt-1 font-mono text-[28px] font-extrabold leading-none tracking-tight text-white sm:text-[32px]">
                {formatCurrency(remaining)}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/15 pt-3">
                <div className="min-w-0">
                  <p className="text-[11px] text-[var(--color-silver)]">Total</p>
                  <p className="mt-0.5 truncate font-mono text-[13px] font-semibold text-white">
                    {formatCurrency(invoiceTotal)}
                  </p>
                </div>
                <div className="min-w-0 text-right">
                  <p className="text-[11px] text-[var(--color-silver)]">Já pago</p>
                  <p className="mt-0.5 truncate font-mono text-[13px] font-semibold text-white">
                    {formatCurrency(alreadyPaid)}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAmount(fullTarget)}
                className={cn(
                  "rounded-xl border px-3 py-3 text-left transition-colors",
                  preset === "full"
                    ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-white"
                    : "border-[var(--color-fog)] bg-[var(--color-white)] text-[var(--color-ink)]"
                )}
              >
                <span className="block text-[11px] opacity-70">
                  Total restante
                </span>
                <span className="mt-0.5 block font-mono text-[13px] font-semibold">
                  {formatCurrency(fullTarget)}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setAmount(halfTarget)}
                className={cn(
                  "rounded-xl border px-3 py-3 text-left transition-colors",
                  preset === "half"
                    ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-white"
                    : "border-[var(--color-fog)] bg-[var(--color-white)] text-[var(--color-ink)]"
                )}
              >
                <span className="block text-[11px] opacity-70">Metade</span>
                <span className="mt-0.5 block font-mono text-[13px] font-semibold">
                  {formatCurrency(halfTarget)}
                </span>
              </button>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[12px] font-medium text-[var(--color-silver)]">
                Valor do pagamento
              </Label>
              <MoneyInput
                value={amount}
                onValueChange={setAmount}
                className="h-12 rounded-xl border-[var(--color-fog)] bg-[var(--color-white)] text-base"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[12px] font-medium text-[var(--color-silver)]">
                Conta de saída
              </Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger className="h-12 rounded-xl border-[var(--color-fog)] bg-[var(--color-white)]">
                  <SelectValue placeholder="Selecionar conta" />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-[40vh]">
                  {activeAccounts.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-[var(--color-silver)]">
                      Nenhuma conta ativa
                    </div>
                  ) : (
                    activeAccounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                        {a.bank ? ` · ${a.bank}` : ""}
                        {a.is_shared === false ? " · pessoal" : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[12px] font-medium text-[var(--color-silver)]">
                Data
              </Label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="h-12 rounded-xl border-[var(--color-fog)] bg-[var(--color-white)] text-base"
              />
            </div>

            <div className="space-y-1.5 pb-1">
              <Label className="text-[12px] font-medium text-[var(--color-silver)]">
                Observação
                <span className="font-normal text-[var(--color-mist)]">
                  {" "}
                  (opcional)
                </span>
              </Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex.: pago parcial via PIX"
                className="h-12 rounded-xl border-[var(--color-fog)] bg-[var(--color-white)]"
              />
            </div>

            {error && (
              <p className="rounded-xl bg-[var(--color-pearl)] px-3 py-2 text-sm text-[var(--color-expense)]">
                {error}
              </p>
            )}
          </div>

          <DrawerFooter>
            <Btn
              variant="primary"
              fullWidth
              size="lg"
              disabled={busy || activeAccounts.length === 0 || !(amount > 0)}
              onClick={() => void onSubmit()}
            >
              {busy
                ? "Registrando…"
                : `Pagar ${formatCurrency(amount > 0 ? amount : 0)}`}
            </Btn>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {cardOwnerMemberId ? (
        <InvoiceSettlementSuggestDialog
          open={suggestOpen}
          onOpenChange={setSuggestOpen}
          member={member}
          cardOwnerMemberId={cardOwnerMemberId}
          owedAmount={owedAmount}
        />
      ) : null}
    </>
  );
}
