import { streamText, tool, stepCountIs } from "ai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMember } from "@/lib/supabase/workspace";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { mapAiProviderError } from "@/lib/ai/errors";
import { getAiLanguageModel } from "@/lib/ai/provider";

/**
 * POST /api/ai/chat — streaming de texto
 * Preferência: GROQ_API_KEY (free) → OPENAI_API_KEY
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

  const result = streamText({
    model: ai.model,
    maxRetries: 0,
    system: `Você é o assistente financeiro do Melza (workspaces pessoais e compartilhados, Brasil).
Responda em português, de forma objetiva, com valores em R$.
SEMPRE use as tools para consultar dados reais antes de responder sobre:
assinaturas, gastos, cartões, contas, empréstimos ou saldos.
Se a tool retornar lista vazia, diga que não há registros — não invente.`,
    messages: messages.map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    })),
    stopWhen: stepCountIs(6),
    tools: {
      listSubscriptions: tool({
        description:
          "Lista assinaturas/recorrências do workspace (Netflix, Spotify, etc.). Use quando perguntarem sobre assinaturas, mensalidades ou recorrentes.",
        inputSchema: z.object({
          activeOnly: z
            .boolean()
            .optional()
            .describe("true = só ativas (padrão); false = todas"),
        }),
        execute: async ({ activeOnly = true }) => {
          let q = supabase
            .from("subscriptions")
            .select(
              "name, amount, billing_cycle, next_billing_date, is_active, notes, cards(name), accounts(name), categories(name)"
            )
            .eq("workspace_id", workspaceId)
            .order("name", { ascending: true });
          if (activeOnly) q = q.eq("is_active", true);
          const { data, error } = await q;
          if (error) return { error: error.message };
          const items = (data ?? []).map((s) => {
            const card = s.cards as { name?: string } | null;
            const account = s.accounts as { name?: string } | null;
            const category = s.categories as { name?: string } | null;
            return {
              name: s.name,
              amount: Number(s.amount),
              cycle: s.billing_cycle,
              nextBilling: s.next_billing_date,
              active: s.is_active,
              paidWith: card?.name ?? account?.name ?? null,
              category: category?.name ?? null,
              notes: s.notes,
            };
          });
          const monthlyTotal = items
            .filter((i) => i.active)
            .reduce((sum, i) => {
              if (i.cycle === "yearly") return sum + i.amount / 12;
              if (i.cycle === "weekly") return sum + i.amount * 4.33;
              return sum + i.amount;
            }, 0);
          return {
            count: items.length,
            monthlyEstimate: Math.round(monthlyTotal * 100) / 100,
            subscriptions: items,
          };
        },
      }),
      listCards: tool({
        description: "Lista cartões cadastrados no workspace.",
        inputSchema: z.object({
          activeOnly: z.boolean().optional(),
        }),
        execute: async ({ activeOnly = true }) => {
          let q = supabase
            .from("cards")
            .select(
              "name, bank, last_four, card_type, closing_day, due_day, credit_limit, is_active"
            )
            .eq("workspace_id", workspaceId)
            .order("name");
          if (activeOnly) q = q.eq("is_active", true);
          const { data, error } = await q;
          if (error) return { error: error.message };
          return {
            count: data?.length ?? 0,
            cards: (data ?? []).map((c) => ({
              name: c.name,
              bank: c.bank,
              lastFour: c.last_four,
              type: c.card_type,
              closingDay: c.closing_day,
              dueDay: c.due_day,
              limit: c.credit_limit != null ? Number(c.credit_limit) : null,
              active: c.is_active,
            })),
          };
        },
      }),
      queryExpenses: tool({
        description:
          "Soma despesas/receitas no período. Datas em YYYY-MM-DD.",
        inputSchema: z.object({
          from: z.string(),
          to: z.string(),
          descriptionContains: z.string().optional(),
          type: z.enum(["expense", "income", "all"]).optional(),
        }),
        execute: async ({ from, to, descriptionContains, type = "expense" }) => {
          let q = supabase
            .from("transactions")
            .select("amount, description, transaction_type, transaction_date")
            .eq("workspace_id", workspaceId)
            .gte("transaction_date", from)
            .lte("transaction_date", to)
            .neq("status", "cancelled");

          if (type === "expense") {
            q = q.in("transaction_type", ["expense", "loan_given"]);
          } else if (type === "income") {
            q = q.in("transaction_type", ["income", "loan_received"]);
          }
          if (descriptionContains) {
            q = q.ilike("description", `%${descriptionContains}%`);
          }

          const { data, error } = await q;
          if (error) return { error: error.message };
          const total = (data ?? []).reduce(
            (s, t) => s + Number(t.amount),
            0
          );
          return {
            total,
            count: data?.length ?? 0,
            samples: (data ?? []).slice(0, 8),
          };
        },
      }),
      topCards: tool({
        description: "Cartões mais usados (despesa) no período.",
        inputSchema: z.object({
          from: z.string(),
          to: z.string(),
        }),
        execute: async ({ from, to }) => {
          const { data, error } = await supabase
            .from("transactions")
            .select("amount, card_id, cards(name)")
            .eq("workspace_id", workspaceId)
            .gte("transaction_date", from)
            .lte("transaction_date", to)
            .in("transaction_type", ["expense", "loan_given"])
            .neq("status", "cancelled")
            .not("card_id", "is", null);
          if (error) return { error: error.message };
          const map = new Map<string, { name: string; total: number }>();
          for (const row of data ?? []) {
            const cards = row.cards as { name?: string } | null;
            const name = cards?.name ?? "Cartão";
            const key = row.card_id as string;
            const prev = map.get(key) ?? { name, total: 0 };
            prev.total += Number(row.amount);
            map.set(key, prev);
          }
          return Array.from(map.values()).sort((a, b) => b.total - a.total);
        },
      }),
      openLoans: tool({
        description: "Empréstimos em aberto / parciais com terceiros.",
        inputSchema: z.object({
          thirdPartyName: z.string().optional(),
        }),
        execute: async ({ thirdPartyName }) => {
          const { data, error } = await supabase
            .from("loans")
            .select(
              "direction, original_amount, paid_amount, status, description, third_parties(name)"
            )
            .eq("workspace_id", workspaceId)
            .in("status", ["open", "partial"]);
          if (error) return { error: error.message };
          let rows = data ?? [];
          if (thirdPartyName) {
            const needle = thirdPartyName.toLowerCase();
            rows = rows.filter((r) => {
              const tp = r.third_parties as { name?: string } | null;
              return tp?.name?.toLowerCase().includes(needle);
            });
          }
          return rows.map((r) => {
            const tp = r.third_parties as { name?: string } | null;
            return {
              thirdParty: tp?.name,
              direction: r.direction,
              remaining:
                Number(r.original_amount) - Number(r.paid_amount),
              status: r.status,
              description: r.description,
            };
          });
        },
      }),
    },
  });

  const encoder = new TextEncoder();
  let sent = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        let full = "";
        for await (const delta of result.textStream) {
          full += delta;
          sent = true;
          controller.enqueue(encoder.encode(delta));
        }
        // tools às vezes terminam sem texto — força o texto final
        if (!full.trim()) {
          const fallback = (await result.text).trim();
          if (fallback) {
            sent = true;
            controller.enqueue(encoder.encode(fallback));
          } else {
            controller.enqueue(
              encoder.encode(
                `\n__AI_ERROR__${JSON.stringify({
                  error:
                    "A IA não gerou texto após consultar os dados. Tente perguntar de novo.",
                  code: "EMPTY_RESPONSE",
                })}`
              )
            );
          }
        }
        controller.close();
      } catch (err) {
        const mapped = mapAiProviderError(err);
        if (!sent) {
          controller.enqueue(
            encoder.encode(
              `\n__AI_ERROR__${JSON.stringify({
                error: mapped.message,
                code: mapped.code,
              })}`
            )
          );
        } else {
          controller.enqueue(encoder.encode(`\n\n⚠️ ${mapped.message}`));
        }
        controller.close();
      }
    },
  });

  // Pré-checa falha imediata (quota) antes de devolver 200:
  // o AI SDK só falha ao consumir o stream; então usamos um peek.
  const reader = stream.getReader();
  let first: ReadableStreamReadResult<Uint8Array>;
  try {
    first = await reader.read();
  } catch (err) {
    const mapped = mapAiProviderError(err);
    return new Response(
      JSON.stringify({ error: mapped.message, code: mapped.code }),
      {
        status: mapped.status,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  if (first.value) {
    const preview = new TextDecoder().decode(first.value);
    if (preview.startsWith("\n__AI_ERROR__") || preview.startsWith("__AI_ERROR__")) {
      try {
        const json = JSON.parse(
          preview.replace(/^\n?__AI_ERROR__/, "")
        ) as { error: string; code: string };
        const mapped = mapAiProviderError(json.error);
        return new Response(JSON.stringify(json), {
          status:
            json.code === "INSUFFICIENT_QUOTA"
              ? 402
              : json.code === "RATE_LIMIT"
                ? 429
                : mapped.status,
          headers: { "Content-Type": "application/json" },
        });
      } catch {
        /* fall through to stream */
      }
    }
  }

  const out = new ReadableStream<Uint8Array>({
    async start(controller) {
      if (first.value) controller.enqueue(first.value);
      if (first.done) {
        controller.close();
        return;
      }
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) controller.enqueue(value);
        }
        controller.close();
      } catch (err) {
        const mapped = mapAiProviderError(err);
        controller.enqueue(encoder.encode(`\n\n⚠️ ${mapped.message}`));
        controller.close();
      }
    },
    cancel(reason) {
      void reader.cancel(reason);
    },
  });

  return new Response(out, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Melza-AI-Provider": ai.provider,
    },
  });
}
