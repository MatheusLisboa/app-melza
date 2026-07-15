import { generateText, stepCountIs } from "ai";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMember } from "@/lib/supabase/workspace";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { isRetryableAiError, mapAiProviderError } from "@/lib/ai/errors";
import { getAiLanguageModel } from "@/lib/ai/provider";
import {
  buildChatTools,
  lastUserText,
  pickChatTools,
} from "@/lib/ai/chat-tools";
import { toISODate } from "@/lib/utils/format";

function systemPrompt(opts: { today: string; compact: boolean }) {
  if (opts.compact) {
    return `Assistente Melza. Português, R$. Hoje: ${opts.today}.
Use as tools com JSON válido (boolean true/false). Sem inventar números.`;
  }
  return `Você é o assistente financeiro do Melza (Brasil). Responda em português, objetivo, valores em R$.
Hoje: ${opts.today}.

Para números do app (saldos, faturas, gastos, cartões, Entre Nós), use as tools.
Se a tool vier vazia, diga que não há dados — não invente.

Ações (criar/pagar/cadastrar/categorizar):
1) confirm=false → mostre o preview e o previewId retornado
2) confirm=true somente com o MESMO previewId, após o usuário confirmar
Sem previewId válido a gravação é recusada.
Booleanos true/false; datas YYYY-MM-DD.

Se perguntarem "minha fatura" sem nome do cartão, use getInvoiceCycles sem cardName (lista todos).
Se perguntarem se tem outros cartões, use listCards.`;
}

/**
 * Groq + tools em multi-turno falha com
 * "unsupported content types". Achata o histórico em 1 mensagem de usuário.
 */
function flattenMessagesForGroq(
  messages: { role: string; content: string }[]
): { role: "user"; content: string }[] {
  const cleaned = messages
    .filter(
      (m) =>
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0
    )
    .slice(-8);

  if (cleaned.length === 0) {
    return [{ role: "user", content: "Olá" }];
  }

  if (cleaned.length === 1 && cleaned[0].role === "user") {
    return [{ role: "user", content: cleaned[0].content.trim() }];
  }

  const lines = cleaned.map((m) => {
    const who = m.role === "user" ? "Usuário" : "Assistente";
    return `${who}: ${m.content.trim()}`;
  });

  return [
    {
      role: "user",
      content: `Histórico da conversa:\n${lines.join("\n")}\n\nResponda à última mensagem do Usuário usando as tools se precisar de dados.`,
    },
  ];
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
  const flatMessages = flattenMessagesForGroq(messages);

  async function run(mode: "auto" | "core" | "minimal") {
    const tools = pickChatTools(allTools, userText, mode);
    return generateText({
      model,
      maxRetries: 0,
      temperature: 0.2,
      system: systemPrompt({
        today,
        compact: mode === "minimal",
      }),
      messages: flatMessages,
      stopWhen: stepCountIs(mode === "minimal" ? 4 : 6),
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
      if (!isRetryableAiError(err)) throw err;
      console.warn("[ai/chat] retryable AI error — minimal tools", err);
      try {
        const second = await run("minimal");
        text = (second.text ?? "").trim();
      } catch (err2) {
        if (!isRetryableAiError(err2)) throw err2;
        console.warn("[ai/chat] retryable again — text only");
        const fallback = await generateText({
          model,
          maxRetries: 0,
          temperature: 0.3,
          system: `Você é o assistente do Melza. Em português.
Não invente saldos nem valores. Explique que a consulta automática falhou e peça para tentar de novo com pergunta curta (ex.: "saldo das contas", "fatura do Nubank", "listar cartões").`,
          messages: flatMessages,
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
