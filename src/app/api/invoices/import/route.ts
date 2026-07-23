import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/supabase/workspace";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { expandInstallmentRows } from "@/lib/invoices/nubank-pdf";
import {
  chargeMatchKey,
  indexExistingCardTxs,
  installmentMatchKey,
  type ExistingCardTx,
} from "@/lib/invoices/match";

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
 * Upsert da fatura: não duplica compras já existentes.
 * Parcelas já lançadas (mesmo nº/total) são atualizadas (ex.: scheduled → confirmed).
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
      .select("id, closing_day, due_day")
      .eq("id", cardId)
      .eq("workspace_id", member.workspace_id)
      .maybeSingle();
    if (cardError || !card) {
      return NextResponse.json(
        { error: "Cartão inválido para este workspace" },
        { status: 400 }
      );
    }

    const { data: existingRaw } = await supabase
      .from("transactions")
      .select(
        "id, transaction_date, description, amount, status, is_installment, installment_number, total_installments, installment_group_id"
      )
      .eq("workspace_id", member.workspace_id)
      .eq("card_id", cardId)
      .neq("status", "cancelled");

    const existing = (existingRaw ?? []) as ExistingCardTx[];
    const index = indexExistingCardTxs(existing);

    const toInsert: Record<string, unknown>[] = [];
    let skipped = 0;
    let updated = 0;
    let futureCreated = 0;
    let imported = 0;

    for (const line of lines) {
      if (line.kind === "payment") {
        skipped++;
        continue;
      }

      const expanded = expandInstallmentRows(
        {
          id: "x",
          date: line.date,
          description: line.description,
          amount: line.amount,
          installmentCurrent: line.installmentCurrent ?? null,
          installmentTotal: line.installmentTotal ?? null,
          kind: "charge",
        },
        {
          closingDay:
            typeof card.closing_day === "number" ? card.closing_day : null,
          dueDay: typeof card.due_day === "number" ? card.due_day : null,
        }
      );

      const isMulti =
        Boolean(line.installmentTotal && line.installmentTotal > 1) &&
        Boolean(line.installmentCurrent);

      // Reusa grupo existente se a parcela atual já existir
      let groupId: string | null = null;
      if (isMulti) {
        const currentKey = installmentMatchKey(
          line.description,
          line.amount,
          line.installmentCurrent!,
          line.installmentTotal!
        );
        const hit = index.byInstallment.get(currentKey);
        if (hit?.installment_group_id) {
          groupId = hit.installment_group_id;
        }
        if (!groupId) groupId = randomUUID();
      }

      for (const row of expanded) {
        if (!createFutureInstallments && row.status === "scheduled") {
          continue;
        }

        const isInstallment = Boolean(groupId && row.totalInstallments > 1);
        const instKey = isInstallment
          ? installmentMatchKey(
              row.description,
              row.amount,
              row.installmentNumber,
              row.totalInstallments
            )
          : null;
        const chargeKey = chargeMatchKey(
          row.date,
          row.description,
          row.amount
        );

        const found =
          (instKey ? index.byInstallment.get(instKey) : undefined) ??
          index.byCharge.get(chargeKey);

        if (found) {
          const needsUpdate =
            found.status !== row.status ||
            found.transaction_date !== row.date ||
            Number(found.amount) !== row.amount;

          if (!needsUpdate) {
            skipped++;
            continue;
          }

          const { error: updErr } = await supabase
            .from("transactions")
            .update({
              transaction_date: row.date,
              amount: row.amount,
              description: row.description,
              status: row.status,
              paid_at:
                row.status === "confirmed" ? new Date().toISOString() : null,
              is_installment: isInstallment,
              installment_number: isInstallment
                ? row.installmentNumber
                : null,
              total_installments: isInstallment
                ? row.totalInstallments
                : null,
              installment_group_id: groupId,
              notes: "Atualizado via fatura Nubank (CSV/OFX)",
              tags: ["import", "nubank", "invoice"],
            })
            .eq("id", found.id)
            .eq("workspace_id", member.workspace_id);

          if (updErr) {
            return NextResponse.json(
              {
                error: updErr.message,
                imported,
                updated,
                skipped,
                futureCreated,
              },
              { status: 500 }
            );
          }

          const refreshed: ExistingCardTx = {
            ...found,
            transaction_date: row.date,
            description: row.description,
            amount: row.amount,
            status: row.status,
            is_installment: isInstallment,
            installment_number: isInstallment
              ? row.installmentNumber
              : null,
            total_installments: isInstallment
              ? row.totalInstallments
              : null,
          };
          index.byCharge.set(chargeKey, refreshed);
          if (instKey) index.byInstallment.set(instKey, refreshed);
          updated++;
          continue;
        }

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

        // evita duplicar no mesmo batch
        const placeholder: ExistingCardTx = {
          id: `pending-${toInsert.length}`,
          transaction_date: row.date,
          description: row.description,
          amount: row.amount,
          status: row.status,
          is_installment: isInstallment,
          installment_number: isInstallment ? row.installmentNumber : null,
          total_installments: isInstallment ? row.totalInstallments : null,
        };
        index.byCharge.set(chargeKey, placeholder);
        if (instKey) index.byInstallment.set(instKey, placeholder);

        if (row.status === "scheduled") futureCreated++;
      }
    }

    if (toInsert.length > 0) {
      const chunkSize = 80;
      for (let i = 0; i < toInsert.length; i += chunkSize) {
        const chunk = toInsert.slice(i, i + chunkSize);
        const { error } = await supabase.from("transactions").insert(chunk);
        if (error) {
          return NextResponse.json(
            { error: error.message, imported, updated, skipped, futureCreated },
            { status: 500 }
          );
        }
        imported += chunk.length;
      }
    }

    if (imported === 0 && updated === 0) {
      return NextResponse.json({
        imported: 0,
        updated: 0,
        skipped,
        futureCreated: 0,
        message:
          skipped > 0
            ? `Nada novo — ${skipped} compra${skipped === 1 ? "" : "s"} já existia${skipped === 1 ? "" : "m"}.`
            : "Nada para importar.",
      });
    }

    return NextResponse.json({
      imported,
      updated,
      skipped,
      futureCreated,
      message: [
        imported ? `${imported} nova${imported === 1 ? "" : "s"}` : null,
        updated ? `${updated} atualizada${updated === 1 ? "" : "s"}` : null,
        skipped ? `${skipped} já existente${skipped === 1 ? "" : "s"}` : null,
        futureCreated
          ? `${futureCreated} parcela${futureCreated === 1 ? "" : "s"} futura${futureCreated === 1 ? "" : "s"}`
          : null,
      ]
        .filter(Boolean)
        .join(" · "),
    });
  } catch (err) {
    console.error("[invoices/import]", err);
    return NextResponse.json(
      { error: "Falha na importação" },
      { status: 500 }
    );
  }
}
