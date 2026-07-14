import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";

const bodySchema = z.object({
  description: z.string().min(1),
  amount: z.number().optional(),
  workspaceId: z.string().uuid(),
});

/**
 * POST /api/ai/categorize
 * Sem OPENAI_API_KEY → 503 com mensagem amigável (não quebra o form).
 */
export async function POST(request: Request) {
  try {
    const limited = rateLimit({
      key: `ai-cat:${clientIp(request)}`,
      limit: 30,
      windowMs: 60 * 1000,
    });
    if (!limited.ok) {
      return NextResponse.json(
        { error: "Muitas requisições. Aguarde um momento." },
        {
          status: 429,
          headers: { "Retry-After": String(limited.retryAfterSec) },
        }
      );
    }

    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error: "OPENAI_API_KEY não configurada",
          code: "MISSING_API_KEY",
        },
        { status: 503 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { data: member } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", user.id)
      .eq("workspace_id", parsed.data.workspaceId)
      .maybeSingle();

    if (!member) {
      return NextResponse.json({ error: "Workspace inválido" }, { status: 403 });
    }

    const { data: categories } = await supabase
      .from("categories")
      .select("id, name, type, icon")
      .eq("workspace_id", parsed.data.workspaceId)
      .eq("type", "expense");

    if (!categories?.length) {
      return NextResponse.json(
        { error: "Sem categorias" },
        { status: 400 }
      );
    }

    const openai = createOpenAI({ apiKey: apiKey.trim() });
    const list = categories
      .map((c) => `${c.id} | ${c.icon ?? ""} ${c.name}`)
      .join("\n");

    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      maxRetries: 0,
      schema: z.object({
        categoryId: z.string(),
        categoryName: z.string(),
        confidence: z.number().min(0).max(1),
      }),
      system:
        "Você é um assistente de categorização financeira para workspaces (pessoal/compartilhados) no Brasil. Com base na descrição e valor da transação, retorne APENAS um JSON com: categoryId (da lista fornecida), categoryName e confidence (0-1). Seja preciso: 'iFood' = Alimentação, 'Netflix' = Assinaturas, 'Posto Shell' = Transporte.",
      prompt: `Categorias disponíveis (id | nome):\n${list}\n\nDescrição: ${parsed.data.description}\nValor: ${parsed.data.amount ?? "N/A"}`,
    });

    const match = categories.find((c) => c.id === object.categoryId);
    if (!match) {
      const byName = categories.find(
        (c) =>
          c.name.toLowerCase() === object.categoryName.toLowerCase()
      );
      if (!byName) {
        return NextResponse.json(
          { error: "Categoria sugerida inválida" },
          { status: 422 }
        );
      }
      return NextResponse.json({
        categoryId: byName.id,
        categoryName: byName.name,
        confidence: object.confidence,
      });
    }

    return NextResponse.json({
      categoryId: match.id,
      categoryName: match.name,
      confidence: object.confidence,
    });
  } catch (err) {
    console.error("[ai/categorize]", err);
    return NextResponse.json(
      { error: "Falha na categorização" },
      { status: 500 }
    );
  }
}
