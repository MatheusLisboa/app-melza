/** Mensagens amigáveis a partir de erros da OpenAI / AI SDK */

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
    lower.includes("billing")
  ) {
    return {
      message:
        "A conta OpenAI está sem créditos/quota. Adicione pagamento em platform.openai.com/account/billing ou troque a OPENAI_API_KEY.",
      code: "INSUFFICIENT_QUOTA",
      status: 402,
    };
  }

  if (statusCode === 401 || lower.includes("incorrect api key") || lower.includes("invalid_api_key")) {
    return {
      message: "OPENAI_API_KEY inválida. Verifique o .env.local e reinicie o servidor.",
      code: "INVALID_API_KEY",
      status: 401,
    };
  }

  if (statusCode === 429 || lower.includes("rate limit")) {
    return {
      message: "Limite de requisições da OpenAI. Aguarde alguns segundos e tente de novo.",
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
