"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createSettlementAction } from "@/lib/actions/settlement";
import { invalidateFinanceQueries } from "@/lib/finance/invalidate";
import { useAccounts, useWorkspaceMembers } from "@/lib/hooks/use-finance";
import {
  debtAmountForTx,
  resolveEntreNosPair,
  type EntreNosTx,
} from "@/lib/finance/entre-nos";
import { formatCurrency, toISODate } from "@/lib/utils/format";
import { Btn } from "@/components/design-system";
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
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import type { WorkspaceMember } from "@/types";

/** Soma o que `member` deve ao dono do cartão no ciclo da fatura. */
export async function computeInvoiceOwedToCardOwner(params: {
  workspaceId: string;
  cardId: string;
  cardOwnerMemberId: string;
  consumerMemberId: string;
  cycleFrom: string;
  cycleTo: string;
}): Promise<number> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select(
      `
      id, amount, description, transaction_type, paid_by_member_id,
      consumer_member_id, consumer_share_percent, transaction_date,
      card:cards!card_id(id, name, owner_member_id)
    `
    )
    .eq("workspace_id", params.workspaceId)
    .eq("card_id", params.cardId)
    .eq("transaction_type", "expense")
    .neq("status", "cancelled")
    .gte("transaction_date", params.cycleFrom)
    .lte("transaction_date", params.cycleTo);
  if (error) throw new Error(error.message);

  let total = 0;
  for (const raw of data ?? []) {
    const tx = raw as EntreNosTx;
    const pair = resolveEntreNosPair(tx);
    if (!pair) continue;
    if (pair.consumerId !== params.consumerMemberId) continue;
    if (pair.payerId !== params.cardOwnerMemberId) continue;
    total += debtAmountForTx(tx);
  }
  return Math.round(total * 100) / 100;
}

export function InvoiceSettlementSuggestDialog({
  open,
  onOpenChange,
  member,
  cardOwnerMemberId,
  owedAmount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: WorkspaceMember;
  cardOwnerMemberId: string;
  owedAmount: number;
}) {
  const qc = useQueryClient();
  const { data: members = [] } = useWorkspaceMembers(member.workspace_id);
  const { data: accounts = [] } = useAccounts(member.workspace_id);
  const [accountId, setAccountId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const creditor = members.find((m) => m.id === cardOwnerMemberId);
  const personalAccounts = useMemo(() => {
    const list = accounts.filter((a) => a.is_active);
    return [...list].sort((a, b) => {
      const score = (acc: (typeof list)[0]) => {
        if (acc.is_shared === false && acc.owner_member_id === member.id)
          return 0;
        if (acc.is_shared !== false) return 1;
        return 2;
      };
      return score(a) - score(b);
    });
  }, [accounts, member.id]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setAccountId((prev) => prev || personalAccounts[0]?.id || "");
  }, [open, personalAccounts]);

  async function registerSettlement() {
    if (!creditor || !(owedAmount > 0) || !accountId) {
      const msg = "Selecione a conta de saída";
      setError(msg);
      toast.error(msg);
      return;
    }
    setBusy(true);
    setError(null);
    const res = await createSettlementAction({
      amount: owedAmount,
      fromMemberId: member.id,
      toMemberId: creditor.id,
      accountId,
      paymentDate: toISODate(new Date()),
      notes: "Acerto sugerido após pagamento da fatura",
      paymentChannel: "pix",
    });
    setBusy(false);
    if (res.error) {
      setError(res.error);
      toast.error(res.error);
      return;
    }
    toast.success("Acerto registrado no Entre Nós");
    invalidateFinanceQueries(qc);
    onOpenChange(false);
  }

  if (!creditor || owedAmount < 1) return null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="border-b border-[var(--color-fog)]">
          <DrawerTitle>Registrar acerto no Entre Nós?</DrawerTitle>
          <DrawerDescription>
            Nesta fatura há cerca de{" "}
            <span className="font-medium text-[var(--color-ink)]">
              {formatCurrency(owedAmount)}
            </span>{" "}
            de gastos seus no cartão de {creditor.display_name}. Quer registrar
            o reembolso agora?
          </DrawerDescription>
        </DrawerHeader>

        <div className="space-y-3 px-4 py-4 sm:px-5">
          <div className="space-y-1.5">
            <Label className="text-[12px] text-[var(--color-silver)]">
              Conta de saída
            </Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="h-12 rounded-xl border-[var(--color-fog)]">
                <SelectValue placeholder="Conta" />
              </SelectTrigger>
              <SelectContent>
                {personalAccounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                    {a.is_shared === false ? " · pessoal" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error ? (
            <p className="text-sm text-[var(--color-expense)]">{error}</p>
          ) : null}
        </div>

        <DrawerFooter>
          <Btn
            variant="primary"
            fullWidth
            disabled={busy || !accountId}
            onClick={() => void registerSettlement()}
          >
            {busy
              ? "Registrando…"
              : `Sim, acertar ${formatCurrency(owedAmount)}`}
          </Btn>
          <Btn
            variant="secondary"
            fullWidth
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Agora não
          </Btn>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
