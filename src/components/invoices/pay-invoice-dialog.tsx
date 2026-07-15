"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { payInvoiceAction } from "@/lib/actions/invoices";
import { useAccounts } from "@/lib/hooks/use-finance";
import { formatCurrency, toISODate } from "@/lib/utils/format";
import { MoneyInput } from "@/components/transactions/money-input";
import { Btn } from "@/components/design-system";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { WorkspaceMember } from "@/types";

export function PayInvoiceDialog({
  open,
  onOpenChange,
  member,
  cardId,
  cardName,
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
      setError("Selecione a conta de pagamento");
      return;
    }
    if (!(amount > 0)) {
      setError("Informe um valor válido");
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
      return;
    }
    await qc.invalidateQueries({ queryKey: ["invoices"] });
    await qc.invalidateQueries({ queryKey: ["invoice-payments"] });
    await qc.invalidateQueries({ queryKey: ["dashboard"] });
    await qc.invalidateQueries({ queryKey: ["transactions"] });
    await qc.invalidateQueries({ queryKey: ["accounts"] });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Pagar fatura</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-[12px] border border-[var(--color-line)] bg-[var(--color-chip)] p-3.5">
            <p className="text-[12px] text-[var(--color-text-2)]">
              {cardName} · {cycleKey}
            </p>
            <div className="mt-2 flex justify-between gap-3 text-sm">
              <span className="text-[var(--color-text-2)]">Total</span>
              <span className="font-mono font-medium text-[var(--color-text)]">
                {formatCurrency(invoiceTotal)}
              </span>
            </div>
            <div className="mt-1 flex justify-between gap-3 text-sm">
              <span className="text-[var(--color-text-2)]">Já pago</span>
              <span className="font-mono font-medium text-[var(--color-text)]">
                {formatCurrency(alreadyPaid)}
              </span>
            </div>
            <div className="mt-1 flex justify-between gap-3 text-sm">
              <span className="text-[var(--color-text-2)]">Restante</span>
              <span className="font-mono font-semibold text-[var(--color-text)]">
                {formatCurrency(remaining)}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              className="flex-1 rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] px-3 py-2 text-xs font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-chip)]"
              onClick={() => setAmount(remaining > 0 ? remaining : invoiceTotal)}
            >
              Valor total restante
            </button>
            <button
              type="button"
              className="flex-1 rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] px-3 py-2 text-xs font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-chip)]"
              onClick={() =>
                setAmount(
                  remaining > 0
                    ? Math.round((remaining / 2) * 100) / 100
                    : Math.round((invoiceTotal / 2) * 100) / 100
                )
              }
            >
              Metade
            </button>
          </div>

          <div className="space-y-1.5">
            <Label>Valor do pagamento</Label>
            <MoneyInput value={amount} onValueChange={setAmount} />
          </div>

          <div className="space-y-1.5">
            <Label>Conta</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar conta" />
              </SelectTrigger>
              <SelectContent>
                {activeAccounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Data</Label>
            <Input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Observação (opcional)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex.: pagamento parcial via PIX"
            />
          </div>

          {error && <p className="text-sm text-[#EF4444]">{error}</p>}

          <Btn
            variant="primary"
            fullWidth
            disabled={busy || activeAccounts.length === 0}
            onClick={() => void onSubmit()}
          >
            {busy ? "Registrando…" : "Confirmar pagamento"}
          </Btn>
        </div>
      </DialogContent>
    </Dialog>
  );
}
