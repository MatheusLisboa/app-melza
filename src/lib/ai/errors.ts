/** Mensagens amigáveis a partir de erros Groq / OpenAI / AI SDK */

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error ?? "");
  } catch {
    return "Erro desconhecido na IA";
  }
}

/** Erros recuperáveis: re-tenta com menos tools / prompt flat. */
export function isRetryableAiError(error: unknown): boolean {
  const lower = errorText(error).toLowerCase();
  return (
    lower.includes("failed to call a function") ||
    lower.includes("tool_use_failed") ||
    lower.includes("failed_generation") ||
    lower.includes("adjust your prompt") ||
    lower.includes("unsupported content") ||
    lower.includes("unsupported content types") ||
    lower.includes("unsupported content fields")
  );
}

/** @deprecated use isRetryableAiError */
export function isToolUseFailed(error: unknown): boolean {
  return isRetryableAiError(error);
}

export function mapAiProviderError(error: unknown): {
  message: string;
  code: string;
  status: number;
} {
  const raw = errorText(error);
  const lower = raw.toLowerCase();
  const statusCode =
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof (error as { statusCode: unknown }).statusCode === "number"
      ? (error as { statusCode: number }).statusCode
      : undefined;

  if (isRetryableAiError(error)) {
    return {
      message:
        "A IA falhou ao montar a consulta. Tente de novo com uma pergunta mais curta — ex.: “saldo das contas” ou “fatura do Nubank”.",
      code: "TOOL_USE_FAILED",
      status: 502,
    };
  }

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
