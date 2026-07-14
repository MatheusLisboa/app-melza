import { createOpenAI } from "@ai-sdk/openai";

export type AiProviderId = "groq" | "openai";

type AiModel = ReturnType<ReturnType<typeof createOpenAI>>;

/**
 * Preferência: GROQ (gratis / sem crédito) → OPENAI (pago).
 * Groq é OpenAI-compatible: https://api.groq.com/openai/v1
 */
export function getAiLanguageModel(
  purpose: "chat" | "categorize" = "chat"
):
  | { ok: true; provider: AiProviderId; model: AiModel }
  | { ok: false; code: "MISSING_API_KEY"; error: string } {
  const groqKey = process.env.GROQ_API_KEY?.trim();
  if (groqKey) {
    const groq = createOpenAI({
      apiKey: groqKey,
      baseURL: "https://api.groq.com/openai/v1",
    });
    // chat: 70B com tools; categorize: 8B rápido
    const id =
      purpose === "chat"
        ? "llama-3.3-70b-versatile"
        : "llama-3.1-8b-instant";
    return { ok: true, provider: "groq", model: groq(id) };
  }

  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  if (openaiKey) {
    const openai = createOpenAI({ apiKey: openaiKey });
    return {
      ok: true,
      provider: "openai",
      model: openai("gpt-4o-mini"),
    };
  }

  return {
    ok: false,
    code: "MISSING_API_KEY",
    error:
      "Configure GROQ_API_KEY (gratuito em console.groq.com) ou OPENAI_API_KEY no .env.local / Vercel.",
  };
}
