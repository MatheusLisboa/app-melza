import { createGroq } from "@ai-sdk/groq";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

export type AiProviderId = "groq" | "openai";

/**
 * Provider de IA.
 *
 * AI_PROVIDER:
 * - `groq` (padrão) — só Groq; não cai na OpenAI
 * - `openai` — só OpenAI
 * - `auto` — Groq se houver chave, senão OpenAI
 *
 * Usa `@ai-sdk/groq` nativo (evita "unsupported content types"
 * do adapter OpenAI-compat em multi-turno + tools).
 */
export function getAiLanguageModel(
  purpose: "chat" | "categorize" = "chat"
):
  | { ok: true; provider: AiProviderId; model: LanguageModel }
  | { ok: false; code: "MISSING_API_KEY"; error: string } {
  const mode = (process.env.AI_PROVIDER || "groq").trim().toLowerCase();
  const groqKey = process.env.GROQ_API_KEY?.trim();
  const openaiKey = process.env.OPENAI_API_KEY?.trim();

  const groqModel = () => {
    const groq = createGroq({ apiKey: groqKey! });
    const id =
      purpose === "chat"
        ? "llama-3.3-70b-versatile"
        : "llama-3.1-8b-instant";
    return {
      ok: true as const,
      provider: "groq" as const,
      model: groq(id) as LanguageModel,
    };
  };

  const openaiModel = () => {
    const openai = createOpenAI({ apiKey: openaiKey! });
    return {
      ok: true as const,
      provider: "openai" as const,
      model: openai("gpt-4o-mini") as LanguageModel,
    };
  };

  if (mode === "openai") {
    if (!openaiKey) {
      return {
        ok: false,
        code: "MISSING_API_KEY",
        error: "AI_PROVIDER=openai, mas OPENAI_API_KEY não está configurada.",
      };
    }
    return openaiModel();
  }

  if (mode === "auto") {
    if (groqKey) return groqModel();
    if (openaiKey) return openaiModel();
    return {
      ok: false,
      code: "MISSING_API_KEY",
      error:
        "Configure GROQ_API_KEY (recomendado) ou OPENAI_API_KEY. Veja console.groq.com",
    };
  }

  if (!groqKey) {
    return {
      ok: false,
      code: "MISSING_API_KEY",
      error:
        "Configure GROQ_API_KEY no .env.local e na Vercel (Settings → Environment Variables). Crie em console.groq.com — grátis, sem cartão.",
    };
  }
  return groqModel();
}
