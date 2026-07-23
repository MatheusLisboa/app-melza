"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createSettlementAction } from "@/lib/actions/settlement";
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
  defaultPaymentDate?: string;
  monthLabel?: string;
}) {
  const qc = useQueryClient();
  const { data: accounts = [] } = useAccounts(member.workspace_id);
  const activeAccounts = useMemo(() => {
    const list = accounts.filter((a) => a.is_active);
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
      toast.error(res.error);
      return;
    }
    invalidateFinanceQueries(qc);
    toast.success(
      `Acerto de ${formatCurrency(amount)} registrado`
    );
    onOpenChange(false);
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="border-b border-[var(--color-fog)]">
          <div className="flex items-start justify-between gap-3 pr-8">
            <div className="min-w-0">
              <DrawerTitle>Registrar acerto</DrawerTitle>
              <DrawerDescription className="mt-1 truncate">
                {debtor.display_name} → {creditor.display_name}
                {monthLabel ? ` · ${monthLabel}` : ""}
              </DrawerDescription>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="touch-target absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-pearl)] text-[var(--color-silver)]"
              aria-label="Fechar"
            >
              <span className="text-lg leading-none">×</span>
            </button>
          </div>
        </DrawerHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          <div className="rounded-2xl border border-[var(--color-fog)] bg-[var(--color-pearl)] px-4 py-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-silver)]">
              Saldo a quitar
            </p>
            <p className="mt-1 font-mono text-[28px] font-extrabold leading-none tracking-tight text-[var(--color-ink)] sm:text-[32px]">
              {formatCurrency(remaining)}
            </p>
            {alreadySettled > 0 ? (
              <p className="mt-3 text-[12px] text-[var(--color-silver)]">
                Já acertado antes: {formatCurrency(alreadySettled)}
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setAmount(fullTarget)}
              className={cn(
                "rounded-xl border px-3 py-3 text-left transition-colors",
                preset === "full"
                  ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-white)]"
                  : "border-[var(--color-fog)] bg-[var(--color-white)] text-[var(--color-ink)] active:bg-[var(--color-pearl)]"
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
                "rounded-xl border px-3 py-3 text-left transition-colors",
                preset === "half"
                  ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-white)]"
                  : "border-[var(--color-fog)] bg-[var(--color-white)] text-[var(--color-ink)] active:bg-[var(--color-pearl)]"
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
              Valor do acerto (parcial ok)
            </Label>
            <MoneyInput
              value={amount}
              onValueChange={setAmount}
              className="h-12 rounded-xl border-[var(--color-fog)] bg-[var(--color-white)] text-base"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[12px] font-medium text-[var(--color-silver)]">
              Conta de saída (PIX / transferência)
            </Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="h-12 rounded-xl border-[var(--color-fog)] bg-[var(--color-white)]">
                <SelectValue placeholder="Selecionar conta" />
              </SelectTrigger>
              <SelectContent position="popper" className="max-h-[40vh]">
                {activeAccounts.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-[var(--color-silver)]">
                    Nenhuma conta ativa — cadastre em Contas
                  </div>
                ) : (
                  activeAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                      {a.bank ? ` · ${a.bank}` : ""}
                      {a.is_shared === false ? " · pessoal" : " · compartilhada"}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[12px] font-medium text-[var(--color-silver)]">
              Data do pagamento
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
              placeholder="Ex.: PIX parcial"
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
              : amount >= remaining - 0.009
                ? `Quitar ${formatCurrency(amount > 0 ? amount : 0)}`
                : `Acerto parcial ${formatCurrency(amount > 0 ? amount : 0)}`}
          </Btn>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
