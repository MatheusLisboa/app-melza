import { generateText, stepCountIs } from "ai";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMember } from "@/lib/supabase/workspace";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { isToolUseFailed, mapAiProviderError } from "@/lib/ai/errors";
import { getAiLanguageModel } from "@/lib/ai/provider";
import {
  buildChatTools,
  lastUserText,
  pickChatTools,
} from "@/lib/ai/chat-tools";
import { toISODate } from "@/lib/utils/format";

function systemPrompt(opts: { strictTools: boolean; today: string }) {
  if (opts.strictTools) {
    return `Você é o assistente financeiro do Melza (Brasil). Responda em português, objetivo, valores em R$.
Hoje: ${opts.today}.

Para números do app (saldos, faturas, gastos, Entre Nós), use as tools disponíveis.
Se a tool vier vazia, diga que não há dados — não invente.

Ações (criar/pagar/cadastrar/categorizar):
1) Chame com confirm=false e mostre o preview.
2) Só confirm=true depois do usuário confirmar ("sim", "confirma").
Argumentos das tools: JSON válido; booleanos true/false (não strings); datas YYYY-MM-DD.`;
  }

  return `Você é o assistente financeiro do Melza. Português, objetivo, R$.
Hoje: ${opts.today}.
Use só as tools listadas, com JSON válido (booleanos true/false).
Se falhar a tool, explique sem inventar números.`;
}

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

  const model = ai.model;
  const provider = ai.provider;

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
  const allTools = buildChatTools({ supabase, member, workspaceId });
  const userText = lastUserText(messages);
  const today = toISODate(new Date());
  const mappedMessages = messages.map((m) => ({
    role: m.role as "user" | "assistant" | "system",
    content: m.content,
  }));

  async function run(mode: "auto" | "core" | "minimal") {
    const tools = pickChatTools(allTools, userText, mode);
    return generateText({
      model,
      maxRetries: 0,
      temperature: 0.2,
      system: systemPrompt({
        strictTools: mode !== "minimal",
        today,
      }),
      messages: mappedMessages,
      stopWhen: stepCountIs(mode === "minimal" ? 5 : 8),
      tools,
      toolChoice: "auto",
    });
  }

  try {
    let text = "";
    try {
      const first = await run("auto");
      text = (first.text ?? "").trim();
    } catch (err) {
      if (!isToolUseFailed(err)) throw err;
      console.warn("[ai/chat] tool_use_failed — retry minimal tools", err);
      try {
        const second = await run("minimal");
        text = (second.text ?? "").trim();
      } catch (err2) {
        if (!isToolUseFailed(err2)) throw err2;
        console.warn("[ai/chat] tool_use_failed again — text only");
        const fallback = await generateText({
          model,
          maxRetries: 0,
          temperature: 0.3,
          system: `Você é o assistente do Melza. Em português.
Não invente saldos nem valores. Explique que a consulta automática falhou e peça para o usuário tentar de novo com uma pergunta mais curta (ex.: "saldo das contas", "fatura do Nubank").`,
          messages: mappedMessages,
        });
        text = (fallback.text ?? "").trim();
      }
    }

    if (!text) {
      return new Response(
        JSON.stringify({
          error:
            "A IA consultou os dados mas não gerou texto. Tente perguntar de novo.",
          code: "EMPTY_RESPONSE",
        }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(text, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Melza-AI-Provider": provider,
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
