"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Upload, CreditCard as CreditCardIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useCards, useWorkspaceMembers } from "@/lib/hooks/use-finance";
import type { WorkspaceMember, TransactionWithRelations } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import {
  defaultCycleKey,
  listInvoiceCycles,
} from "@/lib/utils/invoice-cycle";
import { downloadInvoicePdf } from "@/lib/invoices/download-pdf";
import { getBankColor, getBankName } from "@/lib/utils/banks";
import { Btn, TxRow, toDsMember } from "@/components/design-system";
import { NubankInvoiceImportDialog } from "@/components/invoices/nubank-invoice-import";
import { TransactionDetailSheet } from "@/components/transactions/transaction-detail-sheet";
import { cn } from "@/lib/utils";

function cycleMonthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", {
    month: "short",
    year: "2-digit",
  });
}

export function InvoicesClient({ member }: { member: WorkspaceMember }) {
  const { data: cards = [] } = useCards(member.workspace_id);
  const { data: members = [] } = useWorkspaceMembers(member.workspace_id);
  const activeCards = cards.filter((c) => c.is_active);
  const [cardId, setCardId] = useState<string>("");
  const [importOpen, setImportOpen] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const effectiveCardId = cardId || activeCards[0]?.id || "";
  const selectedCard = activeCards.find((c) => c.id === effectiveCardId);

  const cycles = useMemo(
    () =>
      listInvoiceCycles(selectedCard?.closing_day, selectedCard?.due_day, {
        past: 12,
        future: 6,
      }),
    [selectedCard?.closing_day, selectedCard?.due_day]
  );

  const [cycleKey, setCycleKey] = useState("");
  const effectiveKey =
    cycleKey && cycles.some((c) => c.key === cycleKey)
      ? cycleKey
      : defaultCycleKey(cycles);
  const cycle = cycles.find((c) => c.key === effectiveKey) ?? cycles[0];

  const {
    data: transactions = [],
    isLoading,
    isError,
    error,
  } = useQuery({
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
      const { data, error: qError } = await supabase
        .from("transactions")
        .select(
          `
          *,
          category:categories(id, name, icon, color),
          card:cards(id, name, owner_member_id, bank)
        `
        )
        .eq("workspace_id", member.workspace_id)
        .eq("card_id", effectiveCardId)
        .gte("transaction_date", cycle!.from)
        .lte("transaction_date", cycle!.to)
        .neq("status", "cancelled")
        .order("transaction_date", { ascending: false });
      if (qError) throw new Error(qError.message);
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
  const bankColor = selectedCard?.bank
    ? getBankColor(selectedCard.bank)
    : "#111111";

  function onDownloadPdf() {
    if (!selectedCard || !cycle) return;
    setPdfError(null);
    try {
      downloadInvoicePdf({
        cardName: selectedCard.name,
        cycleLabel: cycleMonthLabel(cycle.key),
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
          <h1 className="text-[17px] font-bold tracking-tight text-[var(--color-text)]">
            Faturas
          </h1>
          <p className="mt-0.5 text-sm text-[var(--color-text-2)]">
            Ciclo mensal pelo fechamento do cartão
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn
            variant="secondary"
            size="sm"
            disabled={!effectiveCardId || !cycle}
            onClick={onDownloadPdf}
            icon={<Download className="h-3.5 w-3.5" />}
          >
            PDF
          </Btn>
          <Btn
            variant="primary"
            size="sm"
            disabled={activeCards.length === 0}
            onClick={() => setImportOpen(true)}
            icon={<Upload className="h-3.5 w-3.5" />}
          >
            Importar
          </Btn>
        </div>
      </div>

      {pdfError && <p className="text-sm text-[#EF4444]">{pdfError}</p>}

      {/* Cartões — seletor visual */}
      {!effectiveCardId ? (
        <p className="text-sm text-[var(--color-text-2)]">
          Cadastre um cartão para ver faturas.
        </p>
      ) : (
        <>
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-2)]">
              Cartão
            </p>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {activeCards.map((c) => {
                const active = c.id === effectiveCardId;
                const color = c.bank ? getBankColor(c.bank) : "#111111";
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setCardId(c.id);
                      setCycleKey("");
                    }}
                    className={cn(
                      "relative min-w-[148px] shrink-0 overflow-hidden rounded-[14px] px-4 py-3.5 text-left transition-all",
                      active
                        ? "ring-2 ring-[var(--color-text)] ring-offset-2 ring-offset-[var(--color-page)]"
                        : "opacity-85 hover:opacity-100"
                    )}
                    style={{ backgroundColor: color }}
                  >
                    <div className="relative">
                      <div className="mb-3 flex items-center justify-between">
                        <CreditCardIcon className="h-4 w-4 text-white/90" />
                        {active && (
                          <span className="rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-semibold uppercase text-white">
                            Ativo
                          </span>
                        )}
                      </div>
                      <p className="truncate text-sm font-semibold text-white">
                        {c.name}
                      </p>
                      <p className="mt-0.5 text-[11px] text-white/70">
                        {c.bank ? getBankName(c.bank) : "Cartão"}
                        {c.closing_day ? ` · fecha ${c.closing_day}` : ""}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ciclo por mês */}
          {cycle && (
            <div>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-2)]">
                Ciclo
              </p>
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                {cycles.map((c) => {
                  const active = c.key === effectiveKey;
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setCycleKey(c.key)}
                      className={cn(
                        "shrink-0 rounded-full px-3.5 py-2 text-[13px] font-medium capitalize transition-colors",
                        active
                          ? "bg-[var(--color-ink)] text-white dark:bg-[#F2F2F7] dark:text-[#111]"
                          : "bg-[var(--color-card)] text-[var(--color-text-2)] border border-[var(--color-line)] hover:text-[var(--color-text)]"
                      )}
                    >
                      {cycleMonthLabel(c.key)}
                      {c.isCurrent ? " · atual" : ""}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Hero total */}
          {cycle && (
            <div
              className="overflow-hidden rounded-[14px] px-5 py-5"
              style={{ backgroundColor: bankColor }}
            >
              <div className="pointer-events-none absolute" />
              <p className="text-[11px] font-medium uppercase tracking-wider text-white/70">
                {selectedCard?.name} · {cycleMonthLabel(cycle.key)}
              </p>
              <p className="mt-2 font-mono text-3xl font-extrabold text-white">
                {formatCurrency(total)}
              </p>
              <p className="mt-2 text-sm text-white/70">
                {formatDate(cycle.from)} — {formatDate(cycle.to)}
                {owner ? ` · ${owner.display_name}` : ""}
                {selectedCard?.due_day
                  ? ` · vence dia ${selectedCard.due_day}`
                  : ""}
              </p>
            </div>
          )}

          {isLoading ? (
            <p className="text-sm text-[var(--color-text-2)]">Carregando…</p>
          ) : isError ? (
            <p className="text-sm text-[#EF4444]">
              {error instanceof Error
                ? error.message
                : "Não foi possível carregar a fatura."}
            </p>
          ) : expenseTx.length === 0 ? (
            <p className="text-sm text-[var(--color-text-2)]">
              {cycle?.isFuture
                ? "Nenhuma parcela agendada neste ciclo ainda."
                : "Nenhuma compra neste ciclo."}
            </p>
          ) : (
            <div className="overflow-hidden rounded-[14px] border border-[var(--color-line)] bg-[var(--color-card)]">
              {expenseTx.map((tx, i) => {
                const payerMember = members.find(
                  (m) => m.id === tx.paid_by_member_id
                );
                const consumerMember = members.find(
                  (m) => m.id === tx.consumer_member_id
                );
                const payer = payerMember ? toDsMember(payerMember) : null;
                const consumer = consumerMember
                  ? toDsMember(consumerMember)
                  : payer;
                const cardOwnerMember = members.find(
                  (m) => m.id === tx.card?.owner_member_id
                );
                const cardOwner = cardOwnerMember
                  ? toDsMember(cardOwnerMember)
                  : payer;

                return (
                  <div
                    key={tx.id}
                    className={cn(
                      i > 0 && "border-t border-[var(--color-line-soft)]"
                    )}
                  >
                    <TxRow
                      embedded
                      title={tx.description}
                      category={tx.category?.name}
                      dateLabel={formatDate(tx.transaction_date)}
                      amount={Number(tx.amount)}
                      type="expense"
                      pending={tx.status === "scheduled"}
                      installments={
                        tx.is_installment &&
                        tx.installment_number != null &&
                        tx.total_installments != null
                          ? {
                              current: tx.installment_number,
                              total: tx.total_installments,
                            }
                          : null
                      }
                      consumer={consumer}
                      payer={payer}
                      cardOwner={cardOwner}
                      onClick={() => setDetailId(tx.id)}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <NubankInvoiceImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        cards={cards}
        defaultCardId={effectiveCardId || undefined}
      />

      <TransactionDetailSheet
        open={Boolean(detailId)}
        onOpenChange={(o) => {
          if (!o) setDetailId(null);
        }}
        member={member}
        transactionId={detailId}
      />
    </div>
  );
}
