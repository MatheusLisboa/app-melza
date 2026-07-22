"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Download,
  Upload,
  CreditCard as CreditCardIcon,
  Wallet,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useCards, useWorkspaceMembers } from "@/lib/hooks/use-finance";
import type { WorkspaceMember, TransactionWithRelations } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import {
  defaultCycleKey,
  listInvoiceCycles,
} from "@/lib/utils/invoice-cycle";
import type { InvoicePdfOpts } from "@/lib/invoices/download-pdf";
import { getBankColor, getBankName } from "@/lib/utils/banks";
import { Btn, TxRow, toDsMember } from "@/components/design-system";
import { NubankInvoiceImportDialog } from "@/components/invoices/nubank-invoice-import";
import { PayInvoiceDialog } from "@/components/invoices/pay-invoice-dialog";
import { InvoicePdfPreviewDialog } from "@/components/invoices/invoice-pdf-preview-dialog";
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

function isLightBrand(color: string): boolean {
  const hex = color.replace("#", "");
  if (hex.length !== 6) return false;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.65;
}

export function InvoicesClient({ member }: { member: WorkspaceMember }) {
  const { data: cards = [] } = useCards(member.workspace_id);
  const { data: members = [] } = useWorkspaceMembers(member.workspace_id);
  const activeCards = cards.filter((c) => c.is_active);
  const [cardId, setCardId] = useState<string>("");
  const [importOpen, setImportOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
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

  const { data: payments = [] } = useQuery({
    queryKey: [
      "invoice-payments",
      member.workspace_id,
      effectiveCardId,
      effectiveKey,
    ],
    enabled: Boolean(effectiveCardId && effectiveKey),
    queryFn: async () => {
      const supabase = createClient();
      const { data, error: qError } = await supabase
        .from("transactions")
        .select("id, amount, transaction_date, description, tags, status")
        .eq("workspace_id", member.workspace_id)
        .contains("tags", [
          "invoice_payment",
          `invoice_card:${effectiveCardId}`,
          `invoice_cycle:${effectiveKey}`,
        ])
        .neq("status", "cancelled");
      if (qError) throw new Error(qError.message);
      return (data ?? []) as {
        id: string;
        amount: number;
        transaction_date: string;
        description: string;
        tags: string[] | null;
        status: string;
      }[];
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

  const paidTotal = useMemo(
    () => payments.reduce((sum, p) => sum + Number(p.amount), 0),
    [payments]
  );
  const remaining = Math.max(0, total - paidTotal);

  const owner = members.find((m) => m.id === selectedCard?.owner_member_id);
  const bankColor = selectedCard?.bank
    ? getBankColor(selectedCard.bank)
    : "#111111";
  const lightHero = isLightBrand(bankColor);
  const heroFg = lightHero ? "#111111" : "#FFFFFF";
  const heroMuted = lightHero
    ? "rgba(17,17,17,0.7)"
    : "rgba(255,255,255,0.7)";

  const pdfOpts = useMemo((): InvoicePdfOpts | null => {
    if (!selectedCard || !cycle) return null;
    return {
      cardName: selectedCard.name,
      cycleLabel: cycleMonthLabel(cycle.key),
      from: cycle.from,
      to: cycle.to,
      total,
      paid: paidTotal,
      remaining,
      ownerName: owner?.display_name,
      lines: [
        ...expenseTx.map((tx) => ({
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
        ...payments.map((p) => ({
          date: p.transaction_date,
          description: `Pagamento · ${p.description}`,
          amount: -Number(p.amount),
          installment: null as string | null,
        })),
      ],
    };
  }, [
    selectedCard,
    cycle,
    total,
    paidTotal,
    remaining,
    owner?.display_name,
    expenseTx,
    payments,
  ]);

  function onOpenPdfPreview() {
    if (!pdfOpts) return;
    setPdfError(null);
    setPdfPreviewOpen(true);
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
            onClick={onOpenPdfPreview}
            icon={<Download className="h-3.5 w-3.5" />}
          >
            Ver fatura
          </Btn>
          <Btn
            variant="primary"
            size="sm"
            disabled={!effectiveCardId || !cycle || total <= 0}
            onClick={() => setPayOpen(true)}
            icon={<Wallet className="h-3.5 w-3.5" />}
          >
            Pagar
          </Btn>
          <Btn
            variant="ghost"
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
                          : "border border-[var(--color-line)] bg-[var(--color-card)] text-[var(--color-text-2)] hover:text-[var(--color-text)]"
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

          {cycle && (
            <div
              className="overflow-hidden rounded-[14px] px-5 py-5"
              style={{ backgroundColor: bankColor }}
            >
              <p
                className="text-[11px] font-medium uppercase tracking-wider"
                style={{ color: heroMuted }}
              >
                {selectedCard?.name} · {cycleMonthLabel(cycle.key)}
              </p>
              <p
                className="mt-2 font-mono text-3xl font-extrabold"
                style={{ color: heroFg }}
              >
                {formatCurrency(remaining)}
              </p>
              <p className="mt-1 text-sm" style={{ color: heroMuted }}>
                {paidTotal > 0
                  ? `Restante · fatura ${formatCurrency(total)} · pago ${formatCurrency(paidTotal)}`
                  : `Total da fatura · ${formatCurrency(total)}`}
              </p>
              <p className="mt-2 text-sm" style={{ color: heroMuted }}>
                {formatDate(cycle.from)} — {formatDate(cycle.to)}
                {owner ? ` · ${owner.display_name}` : ""}
                {selectedCard?.due_day
                  ? ` · vence dia ${selectedCard.due_day}`
                  : ""}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setPayOpen(true)}
                  disabled={total <= 0}
                  className="rounded-lg bg-white/20 px-3 py-2 text-[12px] font-semibold backdrop-blur-sm transition-colors hover:bg-white/30 disabled:opacity-40"
                  style={{ color: heroFg }}
                >
                  Pagar fatura
                </button>
                <button
                  type="button"
                  onClick={onOpenPdfPreview}
                  className="rounded-lg bg-white/20 px-3 py-2 text-[12px] font-semibold backdrop-blur-sm transition-colors hover:bg-white/30"
                  style={{ color: heroFg }}
                >
                  Ver PDF
                </button>
              </div>
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
                      emoji={tx.category?.icon}
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

          {payments.length > 0 && (
            <div>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-2)]">
                Pagamentos registrados
              </p>
              <div className="overflow-hidden rounded-[14px] border border-[var(--color-line)] bg-[var(--color-card)]">
                {payments.map((p, i) => (
                  <div
                    key={p.id}
                    className={cn(
                      "flex items-center justify-between px-4 py-3.5",
                      i > 0 && "border-t border-[var(--color-line)]"
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--color-text)]">
                        {p.description}
                      </p>
                      <p className="text-xs text-[var(--color-text-2)]">
                        {formatDate(p.transaction_date)}
                      </p>
                    </div>
                    <p className="font-mono text-sm font-semibold text-[#22C55E]">
                      −{formatCurrency(Number(p.amount))}
                    </p>
                  </div>
                ))}
              </div>
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

      {selectedCard && cycle && (
        <PayInvoiceDialog
          open={payOpen}
          onOpenChange={setPayOpen}
          member={member}
          cardId={selectedCard.id}
          cardName={selectedCard.name}
          cardOwnerMemberId={selectedCard.owner_member_id}
          cycleKey={cycle.key}
          cycleFrom={cycle.from}
          cycleTo={cycle.to}
          invoiceTotal={total}
          alreadyPaid={paidTotal}
        />
      )}

      <InvoicePdfPreviewDialog
        open={pdfPreviewOpen}
        onOpenChange={setPdfPreviewOpen}
        opts={pdfOpts}
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
