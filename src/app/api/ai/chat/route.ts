import { generateText, stepCountIs } from "ai";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMember } from "@/lib/supabase/workspace";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { mapAiProviderError } from "@/lib/ai/errors";
import { getAiLanguageModel } from "@/lib/ai/provider";
import { buildChatTools } from "@/lib/ai/chat-tools";
import { toISODate } from "@/lib/utils/format";

/**
 * POST /api/ai/chat — resposta em texto (generateText + tools)
 * Padrão: GROQ_API_KEY
 */
export async function POST(request: Request) {
  const limited = rateLimit({
    key: `ai-chat:${clientIp(request)}`,
    limit: 15,
    windowMs: 60 * 1000,
  });
  if (!limited.ok) {
    return new Response(
      JSON.stringify({ error: "Muitas requisições. Aguarde um momento." }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(limited.retryAfterSec),
        },
      }
    );
  }

  const ai = getAiLanguageModel("chat");
  if (!ai.ok) {
    return new Response(
      JSON.stringify({
        error: ai.error,
        code: ai.code,
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Não autenticado" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const member = await getCurrentMember();

  if (!member) {
    return new Response(JSON.stringify({ error: "Sem workspace" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await request.json();
  const messages = body.messages as { role: string; content: string }[];

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: "Mensagens inválidas" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const workspaceId = member.workspace_id;
  const tools = buildChatTools({ supabase, member, workspaceId });

  try {
    const { text } = await generateText({
      model: ai.model,
      maxRetries: 1,
      system: `Você é o assistente financeiro do Melza (workspaces pessoais e compartilhados, Brasil).
Responda em português, de forma objetiva, com valores em R$.

CONSULTAS — SEMPRE use tools antes de responder sobre:
assinaturas, gastos, cartões, saldos de contas, limite disponível, faturas/ciclos,
empréstimos, Entre Nós (quem deve a quem), relatórios/orçamento ou categorias.
Se a tool retornar lista vazia, diga que não há registros — não invente.

AÇÕES (criar lançamento, pagar fatura, cadastrar assinatura, batch de categorização):
1) Chame a tool com confirm=false e mostre o PREVIEW ao usuário.
2) Só chame de novo com confirm=true depois que o usuário confirmar claramente (ex.: "sim", "confirma", "pode criar").
3) Se faltar valor, conta/cartão ou descrição, pergunte antes de executar.
Datas em YYYY-MM-DD. Hoje é ${toISODate(new Date())}.`,
      messages: messages.map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      })),
      stopWhen: stepCountIs(10),
      tools,
    });

    const answer = (text ?? "").trim();
    if (!answer) {
      return new Response(
        JSON.stringify({
          error:
            "A IA consultou os dados mas não gerou texto. Tente perguntar de novo.",
          code: "EMPTY_RESPONSE",
        }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(answer, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Melza-AI-Provider": ai.provider,
      },
    });
  } catch (err) {
    console.error("[ai/chat]", err);
    const mapped = mapAiProviderError(err);
    return new Response(
      JSON.stringify({ error: mapped.message, code: mapped.code }),
      {
        status: mapped.status,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
