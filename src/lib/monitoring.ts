export function captureError(error: unknown, context?: string) {
  const payload = {
    context,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    at: new Date().toISOString(),
  };
  console.error("[monitor]", payload);

  // Hook opcional: envie a um endpoint próprio / Sentry SDK quando NEXT_PUBLIC_SENTRY_DSN existir
  if (typeof window === "undefined" && process.env.NEXT_PUBLIC_SENTRY_DSN) {
    // Placeholder — instale @sentry/nextjs e conecte aqui em produção avançada
  }
}

export function captureMessage(message: string, level: "info" | "warn" = "info") {
  console[level === "warn" ? "warn" : "info"]("[monitor]", message);
}
