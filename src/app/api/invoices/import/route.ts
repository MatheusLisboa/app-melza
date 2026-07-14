import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/supabase/workspace";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { expandInstallmentRows } from "@/lib/invoices/nubank-pdf";

export const runtime = "nodejs";

const lineSchema = z.object({
  date: z.string().min(8),
  description: z.string().min(1),
  amount: z.number().positive(),
  installmentCurrent: z.number().int().nullable().optional(),
  installmentTotal: z.number().int().nullable().optional(),
  kind: z.enum(["charge", "payment", "other"]).optional(),
});

const bodySchema = z.object({
  cardId: z.string().uuid(),
  createFutureInstallments: z.boolean().default(true),
  lines: z.array(lineSchema).min(1).max(500),
});

/**
 * POST /api/invoices/import
 * Confirma linhas da fatura Nubank no cartão.
 * Parcelas futuras (após a atual) são criadas como scheduled.
 */
export async function POST(request: Request) {
  try {
    const limited = rateLimit({
      key: `invoice-import:${clientIp(request)}`,
      limit: 10,
      windowMs: 60 * 60 * 1000,
    });
    if (!limited.ok) {
      return NextResponse.json(
        { error: "Limite de importações. Tente mais tarde." },
        {
          status: 429,
          headers: { "Retry-After": String(limited.retryAfterSec) },
        }
      );
    }

    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Payload inválido" },
        { status: 400 }
      );
    }

    const member = await requireMember();
    const supabase = await createClient();
    const { cardId, createFutureInstallments, lines } = parsed.data;

    const { data: card, error: cardError } = await supabase
      .from("cards")
      .select("id")
      .eq("id", cardId)
      .eq("workspace_id", member.workspace_id)
      .maybeSingle();
    if (cardError || !card) {
      return NextResponse.json(
        { error: "Cartão inválido para este workspace" },
        { status: 400 }
      );
    }

    const { data: existing } = await supabase
      .from("transactions")
      .select("transaction_date, description, amount, card_id")
      .eq("workspace_id", member.workspace_id)
      .eq("card_id", cardId)
      .neq("status", "cancelled");

    const existingKeys = new Set(
      (existing ?? []).map(
        (t) =>
          `${t.transaction_date}|${t.description}|${Number(t.amount).toFixed(2)}`
      )
    );

    const toInsert: Record<string, unknown>[] = [];
    let skipped = 0;
    let futureCreated = 0;

    for (const line of lines) {
      if (line.kind === "payment") {
        skipped++;
        continue;
      }

      const expanded = expandInstallmentRows({
        id: "x",
        date: line.date,
        description: line.description,
        amount: line.amount,
        installmentCurrent: line.installmentCurrent ?? null,
        installmentTotal: line.installmentTotal ?? null,
        kind: "charge",
      });

      const groupId =
        line.installmentTotal &&
        line.installmentTotal > 1 &&
        line.installmentCurrent
          ? randomUUID()
          : null;

      for (const row of expanded) {
        if (!createFutureInstallments && row.status === "scheduled") {
          continue;
        }
        const key = `${row.date}|${row.description}|${row.amount.toFixed(2)}`;
        if (existingKeys.has(key)) {
          skipped++;
          continue;
        }
        existingKeys.add(key);

        const isInstallment = Boolean(
          groupId && row.totalInstallments > 1
        );
        toInsert.push({
          workspace_id: member.workspace_id,
          created_by_member_id: member.id,
          paid_by_member_id: member.id,
          consumer_member_id: member.id,
          amount: row.amount,
          currency: "BRL",
          transaction_type: "expense",
          description: row.description,
          notes: "Importado da fatura Nubank (CSV/OFX)",
          card_id: cardId,
          account_id: null,
          is_installment: isInstallment,
          installment_number: isInstallment ? row.installmentNumber : null,
          total_installments: isInstallment ? row.totalInstallments : null,
          installment_group_id: groupId,
          transaction_date: row.date,
          status: row.status,
          paid_at:
            row.status === "confirmed" ? new Date().toISOString() : null,
          tags: ["import", "nubank", "invoice"],
        });
        if (row.status === "scheduled") futureCreated++;
      }
    }

    if (toInsert.length === 0) {
      return NextResponse.json({
        imported: 0,
        skipped,
        futureCreated: 0,
        message: "Nada novo para importar (já cadastrado ou vazio).",
      });
    }

    const chunkSize = 80;
    let imported = 0;
    for (let i = 0; i < toInsert.length; i += chunkSize) {
      const chunk = toInsert.slice(i, i + chunkSize);
      const { error } = await supabase.from("transactions").insert(chunk);
      if (error) {
        return NextResponse.json(
          { error: error.message, imported, skipped, futureCreated },
          { status: 500 }
        );
      }
      imported += chunk.length;
    }

    return NextResponse.json({ imported, skipped, futureCreated });
  } catch (err) {
    console.error("[invoices/import]", err);
    return NextResponse.json(
      { error: "Falha na importação" },
      { status: 500 }
    );
  }
}
