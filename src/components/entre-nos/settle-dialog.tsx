"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createSettlementAction } from "@/lib/actions/settlement";
import { invalidateFinanceQueries } from "@/lib/finance/invalidate";
import { useAccounts } from "@/lib/hooks/use-finance";
import { formatCurrency, toISODate } from "@/lib/utils/format";
import { MoneyInput } from "@/components/transactions/money-input";
import { Btn } from "@/components/design-system";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { cn } from "@/lib/utils";
import type { WorkspaceMember } from "@/types";

export function SettleEntreNosDialog({
  open,
  onOpenChange,
  member,
  debtor,
  creditor,
  netAmount,
  alreadySettled,
  defaultPaymentDate,
  monthLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: WorkspaceMember;
  debtor: WorkspaceMember;
  creditor: WorkspaceMember;
  netAmount: number;
  alreadySettled: number;
  /** Data do acerto no mês visualizado (parcelas ficam no mês da parcela) */
  defaultPaymentDate?: string;
  monthLabel?: string;
}) {
  const qc = useQueryClient();
  const { data: accounts = [] } = useAccounts(member.workspace_id);
  const activeAccounts = useMemo(() => {
    const list = accounts.filter((a) => a.is_active);
    // Pessoal do devedor primeiro, depois compartilhadas, depois outras
    return [...list].sort((a, b) => {
      const score = (acc: (typeof list)[0]) => {
        if (acc.is_shared === false && acc.owner_member_id === debtor.id)
          return 0;
        if (acc.is_shared !== false) return 1;
        return 2;
      };
      return score(a) - score(b);
    });
  }, [accounts, debtor.id]);

  const remaining = Math.max(0, netAmount);
  const [amount, setAmount] = useState(remaining);
  const [accountId, setAccountId] = useState("");
  const [paymentDate, setPaymentDate] = useState(
    defaultPaymentDate ?? toISODate(new Date())
  );
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fullTarget = remaining;
  const halfTarget = Math.round((remaining / 2) * 100) / 100;

  const preset: "full" | "half" | "custom" =
    Math.abs(amount - fullTarget) < 0.005
      ? "full"
      : Math.abs(amount - halfTarget) < 0.005
        ? "half"
        : "custom";

  useEffect(() => {
    if (!open) return;
    setAmount(remaining);
    setPaymentDate(defaultPaymentDate ?? toISODate(new Date()));
    setNotes("");
    setError(null);
    setAccountId((prev) => prev || activeAccounts[0]?.id || "");
  }, [open, remaining, activeAccounts, defaultPaymentDate]);

  async function onSubmit() {
    if (!accountId) {
      setError("Selecione a conta de saída");
      return;
    }
    if (!(amount > 0)) {
      setError("Informe um valor válido");
      return;
    }
    if (amount > remaining + 0.009) {
      setError(
        `Valor maior que o saldo (${formatCurrency(remaining)}). Ajuste para parcial ou total.`
      );
      return;
    }
    setBusy(true);
    setError(null);
    const res = await createSettlementAction({
      amount,
      fromMemberId: debtor.id,
      toMemberId: creditor.id,
      accountId,
      paymentDate,
      notes: notes.trim() || undefined,
      paymentChannel: "pix",
    });
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    invalidateFinanceQueries(qc);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        className="flex max-h-[min(94dvh,100%)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
      >
        <div className="shrink-0 border-b border-[var(--color-line)]">
          <div className="flex justify-center pb-1 pt-2.5 sm:hidden">
            <div className="h-1 w-10 rounded-full bg-[var(--color-mist)]" />
          </div>
          <div className="relative flex items-start justify-between gap-3 px-4 pb-3.5 pt-1 sm:px-5 sm:pt-5">
            <DialogHeader className="min-w-0 space-y-1 pr-10">
              <DialogTitle>Registrar acerto</DialogTitle>
              <DialogDescription className="truncate">
                {debtor.display_name} → {creditor.display_name}
                {monthLabel ? ` · ${monthLabel}` : ""}
              </DialogDescription>
            </DialogHeader>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-chip)] text-[var(--color-text-2)] transition-colors hover:text-[var(--color-text)] sm:right-4 sm:top-4"
              aria-label="Fechar"
            >
              <span className="text-lg leading-none">×</span>
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
            <div className="rounded-[16px] border border-[var(--color-line)] bg-[var(--color-chip)] px-4 py-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-3)]">
                Saldo a quitar
              </p>
              <p className="mt-1 font-mono text-[28px] font-extrabold leading-none tracking-tight text-[var(--color-text)] sm:text-[32px]">
                {formatCurrency(remaining)}
              </p>
              {alreadySettled > 0 ? (
                <p className="mt-3 text-[12px] text-[var(--color-text-3)]">
                  Já acertado antes: {formatCurrency(alreadySettled)}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAmount(fullTarget)}
                className={cn(
                  "rounded-[12px] border px-3 py-3 text-left transition-colors",
                  preset === "full"
                    ? "border-[#111111] bg-[#111111] text-white"
                    : "border-[#E5E5EA] bg-white text-[#111111] hover:bg-[#F2F2F7]"
                )}
              >
                <span className="block text-[11px] opacity-70">Quitar tudo</span>
                <span className="mt-0.5 block font-mono text-[13px] font-semibold">
                  {formatCurrency(fullTarget)}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setAmount(halfTarget)}
                className={cn(
                  "rounded-[12px] border px-3 py-3 text-left transition-colors",
                  preset === "half"
                    ? "border-[#111111] bg-[#111111] text-white"
                    : "border-[#E5E5EA] bg-white text-[#111111] hover:bg-[#F2F2F7]"
                )}
              >
                <span className="block text-[11px] opacity-70">Metade</span>
                <span className="mt-0.5 block font-mono text-[13px] font-semibold">
                  {formatCurrency(halfTarget)}
                </span>
              </button>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[12px] font-medium text-[var(--color-text-2)]">
                Valor do acerto (parcial ok)
              </Label>
              <MoneyInput
                value={amount}
                onValueChange={setAmount}
                className="h-12 rounded-[12px] border-[var(--color-line)] bg-[var(--color-input)] text-base"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[12px] font-medium text-[var(--color-text-2)]">
                Conta de saída (PIX / transferência)
              </Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger className="h-12 rounded-[12px] border-[var(--color-line)] bg-[var(--color-input)]">
                  <SelectValue placeholder="Selecionar conta" />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-[40vh]">
                  {activeAccounts.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-[var(--color-text-2)]">
                      Nenhuma conta ativa — cadastre em Contas
                    </div>
                  ) : (
                    activeAccounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                        {a.bank ? ` · ${a.bank}` : ""}
                        {a.is_shared === false
                          ? " · pessoal"
                          : " · compartilhada"}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[12px] font-medium text-[var(--color-text-2)]">
                Data do pagamento
              </Label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="h-12 rounded-[12px] border-[var(--color-line)] bg-[var(--color-input)] text-base"
              />
            </div>

            <div className="space-y-1.5 pb-1">
              <Label className="text-[12px] font-medium text-[var(--color-text-2)]">
                Observação
                <span className="font-normal text-[var(--color-text-3)]">
                  {" "}
                  (opcional)
                </span>
              </Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex.: PIX parcial"
                className="h-12 rounded-[12px] border-[var(--color-line)] bg-[var(--color-input)]"
              />
            </div>

            {error && (
              <p className="rounded-[12px] bg-[var(--color-chip)] px-3 py-2 text-sm text-[var(--color-expense)]">
                {error}
              </p>
            )}
          </div>

          <div className="shrink-0 border-t border-[var(--color-line)] bg-[var(--color-modal)] px-4 pt-3 pb-[max(0.85rem,env(safe-area-inset-bottom))] sm:px-5">
            <Btn
              variant="primary"
              fullWidth
              size="lg"
              disabled={busy || activeAccounts.length === 0 || !(amount > 0)}
              onClick={() => void onSubmit()}
            >
              {busy
                ? "Registrando…"
                : amount >= remaining - 0.009
                  ? `Quitar ${formatCurrency(amount > 0 ? amount : 0)}`
                  : `Acerto parcial ${formatCurrency(amount > 0 ? amount : 0)}`}
            </Btn>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
