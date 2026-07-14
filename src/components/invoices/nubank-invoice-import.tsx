"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Card } from "@/types";
import type { NubankInvoiceLine } from "@/lib/invoices/nubank-pdf";
import { expandInstallmentRows } from "@/lib/invoices/nubank-pdf";
import { parseNubankInvoiceFile } from "@/lib/invoices/nubank-file";
import {
  chargeMatchKey,
  indexExistingCardTxs,
  installmentMatchKey,
  type ExistingCardTx,
} from "@/lib/invoices/match";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { invalidateFinanceQueries } from "@/lib/finance/invalidate";
import { createClient } from "@/lib/supabase/client";
import { Btn } from "@/components/design-system";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Loader2, Upload } from "lucide-react";

type LineStatus = "new" | "exists" | "update";

export function NubankInvoiceImportDialog({
  open,
  onOpenChange,
  cards,
  defaultCardId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cards: Card[];
  defaultCardId?: string;
}) {
  const qc = useQueryClient();
  const activeCards = useMemo(
    () => cards.filter((c) => c.is_active),
    [cards]
  );

  const [cardId, setCardId] = useState(defaultCardId || "");
  useEffect(() => {
    if (defaultCardId) setCardId(defaultCardId);
  }, [defaultCardId]);
  const effectiveCardId = cardId || activeCards[0]?.id || "";

  const [lines, setLines] = useState<NubankInvoiceLine[]>([]);
  const [lineStatus, setLineStatus] = useState<Record<string, LineStatus>>(
    {}
  );
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [createFuture, setCreateFuture] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setLines([]);
      setSelected({});
      setLineStatus({});
      setFileName(null);
      setError(null);
      setResultMsg(null);
      setParsing(false);
      setImporting(false);
    }
  }, [open]);

  const selectable = lines.filter((l) => lineStatus[l.id] !== "exists");
  const selectedCount = selectable.filter(
    (l) => selected[l.id] !== false
  ).length;
  const selectedTotal = selectable
    .filter((l) => selected[l.id] !== false)
    .reduce((s, l) => s + l.amount, 0);
  const existsCount = lines.filter((l) => lineStatus[l.id] === "exists").length;
  const updateCount = lines.filter((l) => lineStatus[l.id] === "update").length;

  async function classifyLines(
    rows: NubankInvoiceLine[],
    forCardId: string
  ): Promise<Record<string, LineStatus>> {
    const supabase = createClient();
    const { data } = await supabase
      .from("transactions")
      .select(
        "id, transaction_date, description, amount, status, is_installment, installment_number, total_installments"
      )
      .eq("card_id", forCardId)
      .neq("status", "cancelled");

    const index = indexExistingCardTxs((data ?? []) as ExistingCardTx[]);
    const status: Record<string, LineStatus> = {};

    for (const line of rows) {
      const expanded = expandInstallmentRows(line);
      const current = expanded.find((r) => r.status === "confirmed") ?? expanded[0];
      if (!current) {
        status[line.id] = "new";
        continue;
      }

      const isMulti = current.totalInstallments > 1;
      const instKey = isMulti
        ? installmentMatchKey(
            current.description,
            current.amount,
            current.installmentNumber,
            current.totalInstallments
          )
        : null;
      const chargeKey = chargeMatchKey(
        current.date,
        current.description,
        current.amount
      );
      const found =
        (instKey ? index.byInstallment.get(instKey) : undefined) ??
        index.byCharge.get(chargeKey);

      if (!found) {
        status[line.id] = "new";
      } else if (
        found.status !== current.status ||
        found.transaction_date !== current.date
      ) {
        status[line.id] = "update";
      } else {
        status[line.id] = "exists";
      }
    }
    return status;
  }

  async function onFile(file: File | null) {
    if (!file) return;
    setError(null);
    setResultMsg(null);
    setLines([]);
    setFileName(file.name);
    setParsing(true);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const text = String(reader.result ?? "");
        const rows = parseNubankInvoiceFile(text, file.name);
        setLines(rows);
        if (rows.length === 0) {
          setError(
            "Nenhuma compra encontrada. Confira se é a fatura CSV/OFX do cartão."
          );
          return;
        }
        if (!effectiveCardId) {
          const map: Record<string, boolean> = {};
          for (const row of rows) map[row.id] = true;
          setSelected(map);
          return;
        }
        const status = await classifyLines(rows, effectiveCardId);
        setLineStatus(status);
        const map: Record<string, boolean> = {};
        for (const row of rows) {
          map[row.id] = status[row.id] !== "exists";
        }
        setSelected(map);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao ler o arquivo");
      } finally {
        setParsing(false);
      }
    };
    reader.onerror = () => {
      setError("Não foi possível ler o arquivo.");
      setParsing(false);
    };
    reader.readAsText(file, "UTF-8");
  }

  // Reclassifica ao trocar cartão com arquivo já parseado
  useEffect(() => {
    if (!open || lines.length === 0 || !effectiveCardId) return;
    let cancelled = false;
    void (async () => {
      const status = await classifyLines(lines, effectiveCardId);
      if (cancelled) return;
      setLineStatus(status);
      setSelected((prev) => {
        const next = { ...prev };
        for (const line of lines) {
          if (status[line.id] === "exists") next[line.id] = false;
          else if (prev[line.id] === undefined) next[line.id] = true;
        }
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reage a troca de cartão
  }, [effectiveCardId]);

  async function onImport() {
    if (!effectiveCardId) {
      setError("Selecione o cartão da fatura.");
      return;
    }
    const payload = selectable.filter((l) => selected[l.id] !== false);
    if (payload.length === 0) {
      setError(
        existsCount === lines.length
          ? "Todas essas compras já estão cadastradas."
          : "Marque ao menos uma linha nova ou a atualizar."
      );
      return;
    }
    setImporting(true);
    setError(null);
    setResultMsg(null);
    try {
      const res = await fetch("/api/invoices/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId: effectiveCardId,
          createFutureInstallments: createFuture,
          lines: payload,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        imported?: number;
        updated?: number;
        skipped?: number;
        futureCreated?: number;
        message?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Falha na importação");
        return;
      }
      setResultMsg(data.message ?? "Importação concluída.");
      setLines([]);
      setFileName(null);
      invalidateFinanceQueries(qc);
      if ((data.imported ?? 0) + (data.updated ?? 0) > 0) {
        setTimeout(() => onOpenChange(false), 900);
      }
    } catch {
      setError("Erro de rede na importação");
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-white/[0.06] px-5 py-4 text-left">
          <DialogTitle>Importar fatura</DialogTitle>
          <DialogDescription>
            CSV ou OFX do Nubank. Compras já cadastradas são ignoradas;
            parcelas existentes são atualizadas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-white/45">Cartão destino</Label>
            <Select
              value={effectiveCardId}
              onValueChange={setCardId}
              disabled={activeCards.length === 0}
            >
              <SelectTrigger className="h-11 rounded-xl border-white/[0.08] bg-white/[0.03]">
                <SelectValue placeholder="Selecione o cartão" />
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

          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/[0.12] bg-white/[0.02] px-4 py-8 transition-colors hover:border-violet-400/40 hover:bg-violet-400/5">
            <input
              type="file"
              accept=".csv,.ofx,.qfx,text/csv,application/x-ofx,application/vnd.intu.qfx"
              className="hidden"
              disabled={parsing || importing}
              onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
            />
            {parsing ? (
              <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
            ) : (
              <Upload className="h-6 w-6 text-white/35" />
            )}
            <span className="text-sm font-medium text-white/70">
              {parsing
                ? "Lendo arquivo…"
                : fileName
                  ? fileName
                  : "Enviar CSV ou OFX"}
            </span>
          </label>

          {lines.length > 0 && (
            <>
              {(existsCount > 0 || updateCount > 0) && (
                <p className="text-xs text-white/40">
                  {existsCount > 0
                    ? `${existsCount} já cadastrada${existsCount === 1 ? "" : "s"}`
                    : null}
                  {existsCount > 0 && updateCount > 0 ? " · " : null}
                  {updateCount > 0
                    ? `${updateCount} a atualizar`
                    : null}
                </p>
              )}

              <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                <Checkbox
                  id="future-inst"
                  checked={createFuture}
                  onCheckedChange={(v) => setCreateFuture(Boolean(v))}
                />
                <Label htmlFor="future-inst" className="text-sm text-white/70">
                  Criar parcelas futuras faltantes
                </Label>
              </div>

              <div className="flex items-center justify-between text-xs text-white/40">
                <span>
                  {selectedCount} selecionada{selectedCount === 1 ? "" : "s"} ·{" "}
                  {formatCurrency(selectedTotal)}
                </span>
                <button
                  type="button"
                  className="text-violet-400"
                  onClick={() => {
                    const targets = selectable;
                    const allOn = targets.every(
                      (l) => selected[l.id] !== false
                    );
                    const next = { ...selected };
                    for (const l of targets) next[l.id] = !allOn;
                    setSelected(next);
                  }}
                >
                  Alternar seleção
                </button>
              </div>

              <ul className="max-h-56 divide-y divide-white/[0.05] overflow-y-auto rounded-xl border border-white/[0.06]">
                {lines.map((line) => {
                  const st = lineStatus[line.id] ?? "new";
                  const locked = st === "exists";
                  return (
                    <li
                      key={line.id}
                      className="flex items-start gap-3 px-3 py-2.5"
                    >
                      <Checkbox
                        checked={!locked && selected[line.id] !== false}
                        disabled={locked}
                        onCheckedChange={(v) =>
                          setSelected((prev) => ({
                            ...prev,
                            [line.id]: Boolean(v),
                          }))
                        }
                        className="mt-1"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-white/85">
                          {line.description}
                        </p>
                        <p className="text-[11px] text-white/35">
                          {formatDate(line.date)}
                          {line.installmentCurrent && line.installmentTotal
                            ? ` · ${line.installmentCurrent}/${line.installmentTotal}`
                            : ""}
                          {st === "exists" ? " · já existe" : ""}
                          {st === "update" ? " · atualizar" : ""}
                        </p>
                      </div>
                      <span className="shrink-0 font-mono text-[13px] font-semibold text-red-400/90">
                        {formatCurrency(line.amount)}
                      </span>
                    </li>
                  );
                })}
              </ul>

              <Btn
                fullWidth
                size="lg"
                disabled={
                  importing || !effectiveCardId || selectedCount === 0
                }
                onClick={() => void onImport()}
              >
                {importing
                  ? "Sincronizando…"
                  : `Sincronizar ${selectedCount}`}
              </Btn>
            </>
          )}

          {error && (
            <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          {resultMsg && (
            <p className="rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
              {resultMsg}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
