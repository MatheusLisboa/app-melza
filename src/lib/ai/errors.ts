/** Mensagens amigáveis a partir de erros Groq / OpenAI / AI SDK */

export function mapAiProviderError(error: unknown): {
  message: string;
  code: string;
  status: number;
} {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Erro desconhecido na IA";

  const lower = raw.toLowerCase();
  const statusCode =
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof (error as { statusCode: unknown }).statusCode === "number"
      ? (error as { statusCode: number }).statusCode
      : undefined;

  if (
    lower.includes("insufficient_quota") ||
    lower.includes("exceeded your current quota") ||
    (lower.includes("billing") && lower.includes("openai"))
  ) {
    return {
      message:
        "A conta OpenAI está sem créditos. O Melza usa Groq por padrão — configure GROQ_API_KEY na Vercel e remova a dependência da OpenAI.",
      code: "INSUFFICIENT_QUOTA",
      status: 402,
    };
  }

  if (
    statusCode === 401 ||
    lower.includes("invalid api key") ||
    lower.includes("invalid_api_key") ||
    lower.includes("incorrect api key")
  ) {
    return {
      message:
        "Chave de IA inválida. Verifique GROQ_API_KEY (console.groq.com) no .env.local / Vercel e reinicie.",
      code: "INVALID_API_KEY",
      status: 401,
    };
  }

  if (statusCode === 429 || lower.includes("rate limit")) {
    return {
      message:
        "Limite de requisições da IA (Groq/OpenAI). Aguarde alguns segundos e tente de novo.",
      code: "RATE_LIMIT",
      status: 429,
    };
  }

  return {
    message: raw.slice(0, 240),
    code: "AI_ERROR",
    status: 502,
  };
}
