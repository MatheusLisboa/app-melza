import { createBrowserClient } from "@supabase/ssr";

/** Limpa espaços/aspas acidentais no .env */
function clean(value: string | undefined): string {
  if (typeof value !== "string") return "";
  let v = value.trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

type BrowserClient = ReturnType<typeof createBrowserClient>;
let browserClient: BrowserClient | null = null;

/**
 * Cliente Supabase para Client Components (browser).
 * Reutiliza a mesma instância (evita recriar a cada query).
 */
export function createClient() {
  if (browserClient) return browserClient;

  const url = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (!url || !key) {
    throw new Error(
      "Supabase não configurado. Em .env.local use KEY=valor sem aspas nem espaço após =, e reinicie o npm run dev."
    );
  }

  browserClient = createBrowserClient(url, key);
  return browserClient;
}
