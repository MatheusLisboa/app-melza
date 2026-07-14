import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { z } from "zod";
import { extractText } from "unpdf";
import { requireMember } from "@/lib/supabase/workspace";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { getAiLanguageModel } from "@/lib/ai/provider";
import {
  parseNubankInvoiceText,
  type NubankInvoiceLine,
} from "@/lib/invoices/nubank-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const aiItemSchema = z.object({
  date: z.string().describe("YYYY-MM-DD"),
  description: z.string(),
  amount: z.number().positive(),
  installmentCurrent: z.number().int().nullable(),
  installmentTotal: z.number().int().nullable(),
  kind: z.enum(["charge", "payment", "other"]),
});

/**
 * POST /api/invoices/parse-pdf
 * multipart: file (PDF fatura Nubank)
 */
export async function POST(request: Request) {
  try {
    const limited = rateLimit({
      key: `invoice-pdf:${clientIp(request)}`,
      limit: 8,
      windowMs: 60 * 60 * 1000,
    });
    if (!limited.ok) {
      return NextResponse.json(
        { error: "Muitas análises. Aguarde um pouco." },
        {
          status: 429,
          headers: { "Retry-After": String(limited.retryAfterSec) },
        }
      );
    }

    await requireMember();

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Envie um arquivo PDF." },
        { status: 400 }
      );
    }
    if (file.size > 12 * 1024 * 1024) {
      return NextResponse.json(
        { error: "PDF muito grande (máx. 12MB)." },
        { status: 400 }
      );
    }
    if (
      !file.type.includes("pdf") &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      return NextResponse.json(
        { error: "Arquivo precisa ser PDF." },
        { status: 400 }
      );
    }

    const buffer = new Uint8Array(await file.arrayBuffer());
    const extracted = await extractText(buffer, { mergePages: true });
    const text = extracted.text.trim() ? extracted.text : "";

    if (!text.trim()) {
      return NextResponse.json(
        {
          error:
            "Não consegui ler texto neste PDF. Use o PDF da fatura Nubank (não imagem escaneada) ou o CSV.",
        },
        { status: 422 }
      );
    }

    const heuristic = parseNubankInvoiceText(text);
    let lines: NubankInvoiceLine[] = heuristic;
    let source: "heuristic" | "ai" | "heuristic+ai" = "heuristic";

    const ai = getAiLanguageModel("chat");
    if (ai.ok) {
      try {
        const clipped = text.slice(0, 28_000);
        const { object } = await generateObject({
          model: ai.model,
          schema: z.object({ items: z.array(aiItemSchema).max(400) }),
          prompt: `Você extrai lançamentos de uma fatura de cartão Nubank (Brasil).

Regras:
- Extraia COMPRAS / cobranças (kind=charge).
- Pagamentos recebidos da fatura → kind=payment.
- Datas em YYYY-MM-DD.
- Valores positivos em reais.
- Se houver parcela (ex: 3/12, parcela 2 de 10), preencha installmentCurrent e installmentTotal; senão null.
- description sem o trecho da parcela.
- Ignore totais, limites, anúncios e rodapés.
- Se o texto já listar muitas linhas, priorize as compras com data e valor.

Texto da fatura:
---
${clipped}
---`,
        });

        const aiLines: NubankInvoiceLine[] = object.items.map((item, idx) => ({
          id: `ai-${idx}-${item.date}-${item.amount}`,
          date: item.date,
          description: item.description.trim(),
          amount: item.amount,
          installmentCurrent: item.installmentCurrent,
          installmentTotal: item.installmentTotal,
          kind: item.kind,
        }));

        if (aiLines.length >= Math.max(3, heuristic.length * 0.5)) {
          lines = aiLines;
          source = heuristic.length ? "heuristic+ai" : "ai";
        } else if (heuristic.length === 0 && aiLines.length > 0) {
          lines = aiLines;
          source = "ai";
        }
      } catch (err) {
        console.error("[parse-pdf ai]", err);
        // segue com heurística
      }
    }

    if (lines.length === 0) {
      return NextResponse.json(
        {
          error:
            "Não achei compras no PDF. Confirme se é a fatura Nubank em PDF com texto selecionável.",
          preview: text.slice(0, 800),
        },
        { status: 422 }
      );
    }

    const charges = lines.filter((l) => l.kind === "charge");
    const payments = lines.filter((l) => l.kind === "payment");

    return NextResponse.json({
      source,
      textChars: text.length,
      lines: charges.length ? charges : lines,
      paymentsCount: payments.length,
    });
  } catch (err) {
    console.error("[invoices/parse-pdf]", err);
    const message =
      err instanceof Error ? err.message : "Falha ao ler o PDF";
    if (message.includes("Não autenticado") || message.includes("workspace")) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    return NextResponse.json({ error: "Falha ao ler o PDF" }, { status: 500 });
  }
}
