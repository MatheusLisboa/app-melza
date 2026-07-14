"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Account, Card, WorkspaceMember } from "@/types";
import { parseBankCsv, type NubankParsedRow } from "@/lib/utils/csv";
import { formatCurrency } from "@/lib/utils/format";
import { encodePaymentMethod } from "@/lib/utils/payment-method";
import { invalidateFinanceQueries } from "@/lib/finance/invalidate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card as UiCard, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload } from "lucide-react";

export function CsvImportCard({
  member,
  cards,
  accounts,
}: {
  member: WorkspaceMember;
  cards: Card[];
  accounts: Account[];
}) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<NubankParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [importing, setImporting] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  function onFile(file: File | null) {
    setParseError(null);
    setResultMsg(null);
    setRows([]);
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? "");
        const parsed = parseBankCsv(text);
        if (parsed.length === 0) {
          setParseError("Nenhuma linha válida encontrada no CSV.");
          return;
        }
        setRows(parsed);
      } catch (e) {
        setParseError(e instanceof Error ? e.message : "Erro ao ler CSV");
      }
    };
    reader.readAsText(file, "UTF-8");
  }

  async function importRows() {
    if (!paymentMethod || rows.length === 0) {
      setParseError("Selecione a conta/cartão de destino.");
      return;
    }
    setImporting(true);
    setParseError(null);
    setResultMsg(null);

    try {
      const res = await fetch("/api/transactions/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethod,
          rows: rows.map((r) => ({
            date: r.date,
            description: r.description,
            amount: r.amount,
            type: r.type,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setParseError(data.error ?? "Falha na importação");
        return;
      }
      setResultMsg(
        `Importadas ${data.imported} transações` +
          (data.skipped ? ` (${data.skipped} ignoradas)` : "")
      );
      setRows([]);
      invalidateFinanceQueries(qc);    } catch {
      setParseError("Erro de rede na importação");
    } finally {
      setImporting(false);
    }
  }

  const expenses = rows.filter((r) => r.type === "expense");
  const incomes = rows.filter((r) => r.type === "income");

  return (
    <UiCard className="border-border/60">
      <CardHeader>
        <CardTitle className="text-base">Importar CSV</CardTitle>
        <CardDescription>
          Nubank (conta/fatura) ou Inter — colunas Data, Descrição/Estabelecimento e
          Valor. Negativos = despesa na conta; positivos = compra na fatura.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="csv-file">Arquivo</Label>
          <Input
            id="csv-file"
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
        </div>

        {rows.length > 0 && (
          <>
            <p className="text-sm text-muted-foreground">
              {rows.length} linhas · {expenses.length} despesas · {incomes.length}{" "}
              receitas · total despesas{" "}
              <span className="font-money">
                {formatCurrency(
                  expenses.reduce((s, r) => s + r.amount, 0)
                )}
              </span>
            </p>

            <div className="space-y-1">
              <Label>Destino (conta ou cartão)</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar…" />
                </SelectTrigger>
                <SelectContent>
                  {accounts
                    .filter((a) => a.is_active)
                    .map((a) => (
                      <SelectItem
                        key={a.id}
                        value={encodePaymentMethod("account", a.id)}
                      >
                        Conta: {a.name}
                      </SelectItem>
                    ))}
                  {cards
                    .filter((c) => c.is_active)
                    .map((c) => (
                      <SelectItem
                        key={c.id}
                        value={encodePaymentMethod("card", c.id)}
                      >
                        Cartão: {c.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <ul className="max-h-40 overflow-y-auto rounded-lg border border-border/60 text-xs">
              {rows.slice(0, 20).map((r, i) => (
                <li
                  key={`${r.date}-${i}`}
                  className="flex justify-between gap-2 border-b border-border/40 px-3 py-1.5 last:border-0"
                >
                  <span className="truncate">
                    {r.date} · {r.description}
                  </span>
                  <span
                    className={`font-money shrink-0 ${
                      r.type === "expense" ? "text-red-400" : "text-emerald-400"
                    }`}
                  >
                    {r.type === "expense" ? "−" : "+"}
                    {formatCurrency(r.amount)}
                  </span>
                </li>
              ))}
              {rows.length > 20 && (
                <li className="px-3 py-1.5 text-muted-foreground">
                  +{rows.length - 20} linhas…
                </li>
              )}
            </ul>

            <Button
              onClick={() => void importRows()}
              disabled={importing || !paymentMethod}
              className="w-full sm:w-auto"
            >
              <Upload className="mr-1.5 h-4 w-4" />
              {importing ? "Importando…" : `Importar ${rows.length} linhas`}
            </Button>
          </>
        )}

        {parseError && (
          <p className="text-sm text-destructive">{parseError}</p>
        )}
        {resultMsg && (
          <p className="text-sm text-emerald-500">{resultMsg}</p>
        )}

        {/* member usado só para tipagem/contexto futuro */}
        <span className="sr-only">{member.workspace_id}</span>
      </CardContent>
    </UiCard>
  );
}
