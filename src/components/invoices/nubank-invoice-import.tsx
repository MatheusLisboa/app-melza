"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Card } from "@/types";
import type { NubankInvoiceLine } from "@/lib/invoices/nubank-pdf";
import { parseNubankInvoiceFile } from "@/lib/invoices/nubank-file";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { invalidateFinanceQueries } from "@/lib/finance/invalidate";
import { Btn } from "@/components/design-system";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";

export function NubankInvoiceImport({
  cards,
  defaultCardId,
}: {
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
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [createFuture, setCreateFuture] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const selectedCount = lines.filter((l) => selected[l.id] !== false).length;
  const selectedTotal = lines
    .filter((l) => selected[l.id] !== false)
    .reduce((s, l) => s + l.amount, 0);
  const installmentCount = lines.filter(
    (l) =>
      selected[l.id] !== false &&
      l.installmentCurrent &&
      l.installmentTotal &&
      l.installmentTotal > 1
  ).length;

  function onFile(file: File | null) {
    if (!file) return;
    setError(null);
    setResultMsg(null);
    setLines([]);
    setFileName(file.name);
    setParsing(true);

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? "");
        const rows = parseNubankInvoiceFile(text, file.name);
        setLines(rows);
        const map: Record<string, boolean> = {};
        for (const row of rows) map[row.id] = true;
        setSelected(map);
        if (rows.length === 0) {
          setError(
            "Nenhuma compra encontrada. Confira se é a fatura CSV/OFX do cartão."
          );
        }
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

  async function onImport() {
    if (!effectiveCardId) {
      setError("Selecione o cartão da fatura.");
      return;
    }
    const payload = lines.filter((l) => selected[l.id] !== false);
    if (payload.length === 0) {
      setError("Marque ao menos uma linha.");
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
        skipped?: number;
        futureCreated?: number;
        message?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Falha na importação");
        return;
      }
      setResultMsg(
        data.message ??
          `Importadas ${data.imported ?? 0} linhas` +
            (data.futureCreated
              ? ` (${data.futureCreated} parcelas futuras)`
              : "") +
            (data.skipped ? ` · ${data.skipped} ignoradas` : "")
      );
      setLines([]);
      setFileName(null);
      invalidateFinanceQueries(qc);
    } catch {
      setError("Erro de rede na importação");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#111113]">
      <div className="border-b border-white/[0.06] px-4 py-3.5">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-violet-400" />
          <p className="text-[14px] font-semibold text-white/90">
            Importar fatura Nubank
          </p>
        </div>
        <p className="mt-1 text-xs text-white/35">
          CSV ou OFX da fatura. Detecta parcelas (ex.: 3/12) e agenda as futuras.
        </p>
      </div>

      <div className="space-y-4 p-4">
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
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
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
                : "Toque para enviar CSV ou OFX"}
          </span>
          <span className="text-[11px] text-white/30">
            App Nubank → Cartão → Fatura → Exportar
          </span>
        </label>

        {lines.length > 0 && (
          <>
            <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
              <Checkbox
                id="future-inst"
                checked={createFuture}
                onCheckedChange={(v) => setCreateFuture(Boolean(v))}
              />
              <Label htmlFor="future-inst" className="text-sm text-white/70">
                Criar parcelas futuras (agendadas)
                {installmentCount > 0 ? ` · ${installmentCount} com parcela` : ""}
              </Label>
            </div>

            <div className="flex items-center justify-between text-xs text-white/40">
              <span>
                {selectedCount} de {lines.length} ·{" "}
                {formatCurrency(selectedTotal)}
              </span>
              <button
                type="button"
                className="text-violet-400"
                onClick={() => {
                  const allOn = lines.every((l) => selected[l.id] !== false);
                  const next: Record<string, boolean> = {};
                  for (const l of lines) next[l.id] = !allOn;
                  setSelected(next);
                }}
              >
                {lines.every((l) => selected[l.id] !== false)
                  ? "Desmarcar todas"
                  : "Marcar todas"}
              </button>
            </div>

            <ul className="max-h-72 divide-y divide-white/[0.05] overflow-y-auto rounded-xl border border-white/[0.06]">
              {lines.map((line) => (
                <li
                  key={line.id}
                  className="flex items-start gap-3 px-3 py-2.5"
                >
                  <Checkbox
                    checked={selected[line.id] !== false}
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
                        ? ` · parcela ${line.installmentCurrent}/${line.installmentTotal}`
                        : ""}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-[13px] font-semibold text-red-400/90">
                    {formatCurrency(line.amount)}
                  </span>
                </li>
              ))}
            </ul>

            <Btn
              fullWidth
              size="lg"
              disabled={importing || !effectiveCardId || selectedCount === 0}
              onClick={() => void onImport()}
            >
              {importing
                ? "Importando…"
                : `Importar ${selectedCount} lançamento${selectedCount === 1 ? "" : "s"}`}
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
    </div>
  );
}
