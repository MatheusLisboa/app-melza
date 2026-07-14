"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Download, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useCards, useWorkspaceMembers } from "@/lib/hooks/use-finance";
import type { WorkspaceMember, TransactionWithRelations } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import {
  defaultCycleKey,
  listInvoiceCycles,
} from "@/lib/utils/invoice-cycle";
import { downloadInvoicePdf } from "@/lib/invoices/download-pdf";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NubankInvoiceImportDialog } from "@/components/invoices/nubank-invoice-import";

export function InvoicesClient({ member }: { member: WorkspaceMember }) {
  const { data: cards = [] } = useCards(member.workspace_id);
  const { data: members = [] } = useWorkspaceMembers(member.workspace_id);
  const activeCards = cards.filter((c) => c.is_active);
  const [cardId, setCardId] = useState<string>("");
  const [importOpen, setImportOpen] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const effectiveCardId = cardId || activeCards[0]?.id || "";
  const selectedCard = activeCards.find((c) => c.id === effectiveCardId);

  const cycles = useMemo(
    () =>
      listInvoiceCycles(
        selectedCard?.closing_day,
        selectedCard?.due_day
      ),
    [selectedCard?.closing_day, selectedCard?.due_day]
  );

  const [cycleKey, setCycleKey] = useState("");
  const effectiveKey =
    cycleKey && cycles.some((c) => c.key === cycleKey)
      ? cycleKey
      : defaultCycleKey(cycles);
  const cycle = cycles.find((c) => c.key === effectiveKey) ?? cycles[0];

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: [
      "invoices",
      member.workspace_id,
      effectiveCardId,
      cycle?.from,
      cycle?.to,
    ],
    enabled: Boolean(effectiveCardId && cycle),
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("transactions")
        .select(
          `
          *,
          category:categories(*),
          card:cards(*),
          paid_by:workspace_members!paid_by_member_id(*),
          consumer:workspace_members!consumer_member_id(*)
        `
        )
        .eq("workspace_id", member.workspace_id)
        .eq("card_id", effectiveCardId)
        .gte("transaction_date", cycle!.from)
        .lte("transaction_date", cycle!.to)
        .neq("status", "cancelled")
        .order("transaction_date", { ascending: false });
      if (error) throw error;
      return data as TransactionWithRelations[];
    },
  });

  const expenseTx = useMemo(
    () => transactions.filter((t) => t.transaction_type !== "income"),
    [transactions]
  );

  const total = useMemo(
    () => expenseTx.reduce((sum, t) => sum + Number(t.amount), 0),
    [expenseTx]
  );

  const owner = members.find((m) => m.id === selectedCard?.owner_member_id);

  function onDownloadPdf() {
    if (!selectedCard || !cycle) return;
    setPdfError(null);
    try {
      downloadInvoicePdf({
        cardName: selectedCard.name,
        cycleLabel: cycle.label,
        from: cycle.from,
        to: cycle.to,
        total,
        ownerName: owner?.display_name,
        lines: expenseTx.map((tx) => ({
          date: tx.transaction_date,
          description: tx.description,
          amount: Number(tx.amount),
          installment:
            tx.is_installment &&
            tx.installment_number &&
            tx.total_installments
              ? `${tx.installment_number}/${tx.total_installments}`
              : null,
        })),
      });
    } catch (e) {
      setPdfError(
        e instanceof Error ? e.message : "Não foi possível gerar o PDF"
      );
    }
  }

  return (
    <div className="page-pad space-y-5 md:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[17px] font-semibold tracking-tight text-foreground/95">
            Faturas
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Ciclo pelo dia de fechamento do cartão (não o mês civil)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={!effectiveCardId || !cycle}
            onClick={onDownloadPdf}
          >
            <Download className="h-3.5 w-3.5" />
            Baixar PDF
          </Button>
          <Button
            type="button"
            size="sm"
            className="gap-1.5"
            disabled={activeCards.length === 0}
            onClick={() => setImportOpen(true)}
          >
            <Upload className="h-3.5 w-3.5" />
            Importar
          </Button>
        </div>
      </div>

      {pdfError && (
        <p className="text-sm text-destructive">{pdfError}</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:max-w-xl">
        <div className="space-y-1">
          <Label>Cartão</Label>
          <Select
            value={effectiveCardId}
            onValueChange={(v) => {
              setCardId(v);
              setCycleKey("");
            }}
            disabled={activeCards.length === 0}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um cartão" />
            </SelectTrigger>
            <SelectContent>
              {activeCards.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Ciclo da fatura</Label>
          <Select
            value={effectiveKey}
            onValueChange={setCycleKey}
            disabled={!cycle}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {cycles.map((c) => (
                <SelectItem key={c.key} value={c.key}>
                  {c.label}
                  {c.isCurrent ? " · atual" : ""}
                  {c.isNext ? " · próximo" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!effectiveCardId ? (
        <p className="text-sm text-muted-foreground">
          Cadastre um cartão para ver faturas.
        </p>
      ) : cycle ? (
        <>
          <div className="max-w-xl overflow-hidden rounded-2xl border border-white/[0.06] bg-[#111113]">
            <div
              className="h-1.5"
              style={{ backgroundColor: selectedCard?.color ?? "#6366f1" }}
            />
            <div className="space-y-3 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[15px] font-semibold text-white/90">
                  {selectedCard?.name}
                </p>
                {cycle.isCurrent && (
                  <Badge className="bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/15">
                    Ciclo atual
                  </Badge>
                )}
                {cycle.isNext && (
                  <Badge className="bg-amber-500/15 text-amber-400 hover:bg-amber-500/15">
                    Próximo ciclo
                  </Badge>
                )}
              </div>
              <p className="font-mono text-3xl font-semibold text-white/90">
                {formatCurrency(total)}
              </p>
              <div className="space-y-1 text-sm text-white/40">
                <p>
                  Compras de {formatDate(cycle.from)} a{" "}
                  {formatDate(cycle.to)}
                </p>
                {owner && (
                  <p>
                    Cartão de {owner.display_name}
                    {selectedCard?.closing_day
                      ? ` · fecha dia ${selectedCard.closing_day}`
                      : ""}
                    {selectedCard?.due_day
                      ? ` · vence dia ${selectedCard.due_day}`
                      : ""}
                  </p>
                )}
                {!selectedCard?.closing_day && (
                  <p className="text-amber-400/80">
                    Defina o dia de fechamento no cartão para um ciclo preciso.
                  </p>
                )}
              </div>
            </div>
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : expenseTx.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma compra neste ciclo neste cartão.
            </p>
          ) : (
            <ul className="divide-y divide-white/[0.06] rounded-2xl border border-white/[0.06]">
              {expenseTx.map((tx) => (
                <li key={tx.id}>
                  <Link
                    href={`/transactions/${tx.id}`}
                    className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.03]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-white/90">
                        {tx.description}
                      </p>
                      <p className="text-xs text-white/35">
                        {formatDate(tx.transaction_date)}
                        {tx.consumer
                          ? ` · consumiu ${tx.consumer.display_name}`
                          : ""}
                        {tx.paid_by
                          ? ` · pagou ${tx.paid_by.display_name}`
                          : ""}
                      </p>
                    </div>
                    <p className="font-mono text-sm font-semibold text-red-400">
                      {formatCurrency(Number(tx.amount))}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}

      <NubankInvoiceImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        cards={cards}
        defaultCardId={effectiveCardId || undefined}
      />
    </div>
  );
}
