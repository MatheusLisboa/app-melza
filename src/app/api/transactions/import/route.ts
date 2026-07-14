import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/supabase/workspace";
import { parsePaymentMethod } from "@/lib/utils/payment-method";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";

const bodySchema = z.object({
  paymentMethod: z.string().min(1),
  rows: z
    .array(
      z.object({
        date: z.string().min(8),
        description: z.string().min(1),
        amount: z.number().positive(),
        type: z.enum(["expense", "income"]),
      })
    )
    .min(1)
    .max(2000),
});

/**
 * POST /api/transactions/import
 * Importa extrato CSV (Nubank) já parseado no client.
 */
export async function POST(request: Request) {
  try {
    const limited = rateLimit({
      key: `import:${clientIp(request)}`,
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
    const payment = parsePaymentMethod(parsed.data.paymentMethod);
    if (!payment) {
      return NextResponse.json(
        { error: "Meio de pagamento inválido" },
        { status: 400 }
      );
    }

    const card_id = payment.kind === "card" ? payment.id : null;
    const account_id = payment.kind === "account" ? payment.id : null;

    // Evita duplicar: mesma data + descrição + valor + workspace
    const { data: existing } = await supabase
      .from("transactions")
      .select("transaction_date, description, amount")
      .eq("workspace_id", member.workspace_id)
      .neq("status", "cancelled");

    const existingKeys = new Set(
      (existing ?? []).map(
        (t) =>
          `${t.transaction_date}|${t.description}|${Number(t.amount).toFixed(2)}`
      )
    );

    const toInsert = [];
    let skipped = 0;

    for (const row of parsed.data.rows) {
      const key = `${row.date}|${row.description}|${row.amount.toFixed(2)}`;
      if (existingKeys.has(key)) {
        skipped++;
        continue;
      }
      existingKeys.add(key);
      toInsert.push({
        workspace_id: member.workspace_id,
        created_by_member_id: member.id,
        paid_by_member_id: member.id,
        amount: row.amount,
        currency: "BRL",
        transaction_type: row.type,
        description: row.description,
        notes: "Importado do CSV Nubank",
        card_id,
        account_id,
        transaction_date: row.date,
        status: "confirmed",
        paid_at: new Date().toISOString(),
        tags: ["import", "nubank"],
      });
    }

    if (toInsert.length === 0) {
      return NextResponse.json({
        imported: 0,
        skipped,
        message: "Nada novo para importar",
      });
    }

    // Inserção em lotes
    const chunkSize = 100;
    let imported = 0;
    for (let i = 0; i < toInsert.length; i += chunkSize) {
      const chunk = toInsert.slice(i, i + chunkSize);
      const { error } = await supabase.from("transactions").insert(chunk);
      if (error) {
        return NextResponse.json(
          { error: error.message, imported, skipped },
          { status: 500 }
        );
      }
      imported += chunk.length;
    }

    return NextResponse.json({ imported, skipped });
  } catch (err) {
    console.error("[transactions/import]", err);
    return NextResponse.json(
      { error: "Falha na importação" },
      { status: 500 }
    );
  }
}
