import { generateObject, tool } from "ai";
import { z } from "zod";
import type { createClient } from "@/lib/supabase/server";
import type { WorkspaceMember } from "@/types";
import { asBool, toolBool } from "@/lib/ai/loose-bool";
import {
  consumeAiWritePreview,
  stashAiWritePreview,
} from "@/lib/ai/pending-writes";
import { getAiLanguageModel } from "@/lib/ai/provider";
import { createTransactionAction } from "@/lib/actions/transactions";
import { payInvoiceAction } from "@/lib/actions/invoices";
import { createSubscriptionAction } from "@/lib/actions/subscriptions-loans";
import {
  cardAvailableLimit,
  getCurrentInvoiceCycle,
  sumCardCommittedLimit,
  type CardCycleTx,
} from "@/lib/finance/card-cycle";
import { computeEntreNosSettlement } from "@/lib/finance/entre-nos";
import { listInvoiceCycles } from "@/lib/utils/invoice-cycle";
import { encodePaymentMethod } from "@/lib/utils/payment-method";
import { toISODate } from "@/lib/utils/format";

type Supabase = Awaited<ReturnType<typeof createClient>>;

function findByName<T extends { id: string; name: string }>(
  rows: T[],
  needle: string
): { match: T | null; ambiguous: string[] } {
  const n = needle.trim().toLowerCase();
  if (!n) return { match: null, ambiguous: [] };
  const exact = rows.find((r) => r.name.toLowerCase() === n);
  if (exact) return { match: exact, ambiguous: [] };
  const partial = rows.filter((r) => r.name.toLowerCase().includes(n));
  if (partial.length === 1) return { match: partial[0], ambiguous: [] };
  return {
    match: null,
    ambiguous: partial.map((p) => p.name),
  };
}

async function resolveCategoryId(
  supabase: Supabase,
  workspaceId: string,
  type: "expense" | "income",
  categoryName?: string | null
): Promise<string | null> {
  if (!categoryName?.trim()) return null;
  const { data } = await supabase
    .from("categories")
    .select("id, name")
    .eq("workspace_id", workspaceId)
    .eq("type", type);
  const { match, ambiguous } = findByName(data ?? [], categoryName);
  if (match) return match.id;
  if (ambiguous.length) return null;
  return null;
}

export function buildChatTools(opts: {
  supabase: Supabase;
  member: WorkspaceMember;
  workspaceId: string;
}) {
  const { supabase, member, workspaceId } = opts;

  return {
    listSubscriptions: tool({
      description:
        "Lista assinaturas/recorrências do workspace (Netflix, Spotify, etc.).",
      inputSchema: z.object({
        activeOnly: toolBool.describe("true = só ativas (padrão)"),
      }),
      execute: async ({ activeOnly }) => {
        const onlyActive = asBool(activeOnly, true);
        let q = supabase
          .from("subscriptions")
          .select(
            "name, amount, billing_cycle, next_billing_date, is_active, notes, cards(name), accounts(name), categories(name)"
          )
          .eq("workspace_id", workspaceId)
          .order("name", { ascending: true });
        if (onlyActive) q = q.eq("is_active", true);
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
      inputSchema: z.object({ activeOnly: toolBool }),
      execute: async ({ activeOnly }) => {
        const onlyActive = asBool(activeOnly, true);
        let q = supabase
          .from("cards")
          .select(
            "name, bank, last_four, card_type, closing_day, due_day, credit_limit, is_active"
          )
          .eq("workspace_id", workspaceId)
          .order("name");
        if (onlyActive) q = q.eq("is_active", true);
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
      description: "Soma despesas/receitas no período. Datas em YYYY-MM-DD.",
      inputSchema: z.object({
        from: z.string(),
        to: z.string(),
        descriptionContains: z.string().optional(),
        type: z.enum(["expense", "income", "all"]).optional(),
      }),
      execute: async ({
        from,
        to,
        descriptionContains,
        type = "expense",
      }) => {
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
        const total = (data ?? []).reduce((s, t) => s + Number(t.amount), 0);
        return {
          total,
          count: data?.length ?? 0,
          samples: (data ?? []).slice(0, 8),
        };
      },
    }),

    topCards: tool({
      description: "Cartões mais usados (despesa) no período.",
      inputSchema: z.object({ from: z.string(), to: z.string() }),
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
      inputSchema: z.object({ thirdPartyName: z.string().optional() }),
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
            remaining: Number(r.original_amount) - Number(r.paid_amount),
            status: r.status,
            description: r.description,
          };
        });
      },
    }),

    getAccountBalances: tool({
      description:
        "Saldos das contas bancárias/carteiras do workspace (current_balance).",
      inputSchema: z.object({ activeOnly: toolBool }),
      execute: async ({ activeOnly }) => {
        const onlyActive = asBool(activeOnly, true);
        let q = supabase
          .from("accounts")
          .select("name, bank, account_type, current_balance, is_active")
          .eq("workspace_id", workspaceId)
          .order("name");
        if (onlyActive) q = q.eq("is_active", true);
        const { data, error } = await q;
        if (error) return { error: error.message };
        const accounts = (data ?? []).map((a) => ({
          name: a.name,
          bank: a.bank,
          type: a.account_type,
          balance:
            a.current_balance != null ? Number(a.current_balance) : null,
          active: a.is_active,
        }));
        const known = accounts.filter((a) => a.balance != null);
        const total = known.reduce((s, a) => s + (a.balance ?? 0), 0);
        return {
          count: accounts.length,
          totalKnownBalance: Math.round(total * 100) / 100,
          accounts,
        };
      },
    }),

    getCardLimits: tool({
      description:
        "Limite de crédito, comprometido e disponível dos cartões (ciclo atual + parcelas futuras).",
      inputSchema: z.object({
        cardName: z
          .string()
          .optional()
          .describe("Filtrar por nome do cartão; omitir = todos ativos"),
      }),
      execute: async ({ cardName }) => {
        const { data: cards, error } = await supabase
          .from("cards")
          .select(
            "id, name, bank, credit_limit, closing_day, due_day, is_active"
          )
          .eq("workspace_id", workspaceId)
          .eq("is_active", true);
        if (error) return { error: error.message };
        let list = cards ?? [];
        if (cardName) {
          const { match, ambiguous } = findByName(list, cardName);
          if (ambiguous.length)
            return { error: `Vários cartões: ${ambiguous.join(", ")}` };
          if (!match) return { error: `Cartão "${cardName}" não encontrado` };
          list = [match];
        }
        if (!list.length) return { cards: [] };

        const ids = list.map((c) => c.id);
        const { data: txs } = await supabase
          .from("transactions")
          .select(
            "id, amount, transaction_type, status, card_id, description, transaction_date, is_installment, installment_number, total_installments, installment_group_id"
          )
          .eq("workspace_id", workspaceId)
          .in("card_id", ids)
          .neq("status", "cancelled");

        const byCard = new Map<string, CardCycleTx[]>();
        for (const t of (txs ?? []) as CardCycleTx[]) {
          if (!t.card_id) continue;
          const arr = byCard.get(t.card_id) ?? [];
          arr.push(t);
          byCard.set(t.card_id, arr);
        }

        return {
          cards: list.map((c) => {
            const cycle = getCurrentInvoiceCycle(c);
            const cardTxs = byCard.get(c.id) ?? [];
            const { cycleSpend, futureCommitted, committed } =
              sumCardCommittedLimit(cardTxs, cycle);
            const limit =
              c.credit_limit != null ? Number(c.credit_limit) : null;
            return {
              name: c.name,
              bank: c.bank,
              creditLimit: limit,
              cycleKey: cycle?.key ?? null,
              cycleSpend,
              futureCommitted,
              committed,
              available: cardAvailableLimit(limit, committed),
            };
          }),
        };
      },
    }),

    getInvoiceCycles: tool({
      description:
        "Faturas por ciclo: total, pago e restante. Sem cardName = todos os cartões ativos (ciclo atual). Com cardName = um cartão.",
      inputSchema: z.object({
        cardName: z
          .string()
          .optional()
          .describe("Nome do cartão; omitir para listar todas as faturas"),
        cycleKey: z
          .string()
          .optional()
          .describe("YYYY-MM do fechamento; omitir = ciclo atual"),
      }),
      execute: async ({ cardName, cycleKey }) => {
        const { data: cards } = await supabase
          .from("cards")
          .select("id, name, bank, closing_day, due_day, is_active")
          .eq("workspace_id", workspaceId)
          .eq("is_active", true);

        let list = cards ?? [];
        if (cardName?.trim()) {
          const { match, ambiguous } = findByName(list, cardName);
          if (ambiguous.length)
            return { error: `Vários cartões: ${ambiguous.join(", ")}` };
          if (!match)
            return { error: `Cartão "${cardName}" não encontrado` };
          list = [match];
        }
        if (!list.length) {
          return { invoices: [], message: "Nenhum cartão ativo" };
        }

        const cardCycles = list
          .map((card) => {
            const cycles = listInvoiceCycles(card.closing_day, card.due_day, {
              past: 4,
              future: 2,
            });
            const cycle =
              (cycleKey
                ? cycles.find((c) => c.key === cycleKey)
                : cycles.find((c) => c.isCurrent)) ??
              getCurrentInvoiceCycle(card);
            if (!cycle) return null;
            return { card, cycle };
          })
          .filter(Boolean) as {
          card: (typeof list)[number];
          cycle: NonNullable<ReturnType<typeof getCurrentInvoiceCycle>>;
        }[];

        if (!cardCycles.length) return { invoices: [] };

        const minFrom = cardCycles.reduce(
          (m, c) => (c.cycle.from < m ? c.cycle.from : m),
          cardCycles[0].cycle.from
        );
        const maxTo = cardCycles.reduce(
          (m, c) => (c.cycle.to > m ? c.cycle.to : m),
          cardCycles[0].cycle.to
        );
        const cardIds = cardCycles.map((c) => c.card.id);

        const [{ data: txs }, { data: paymentRows }] = await Promise.all([
          supabase
            .from("transactions")
            .select("amount, transaction_type, card_id, transaction_date")
            .eq("workspace_id", workspaceId)
            .in("card_id", cardIds)
            .gte("transaction_date", minFrom)
            .lte("transaction_date", maxTo)
            .neq("status", "cancelled"),
          supabase
            .from("transactions")
            .select("amount, tags")
            .eq("workspace_id", workspaceId)
            .contains("tags", ["invoice_payment"])
            .neq("status", "cancelled"),
        ]);

        const invoices = cardCycles.map(({ card, cycle }) => {
          const total = (txs ?? [])
            .filter(
              (t) =>
                t.card_id === card.id &&
                t.transaction_date >= cycle.from &&
                t.transaction_date <= cycle.to &&
                t.transaction_type !== "income"
            )
            .reduce((s, t) => s + Number(t.amount), 0);

          const paid = (paymentRows ?? [])
            .filter((p) => {
              const tags = (p.tags as string[] | null) ?? [];
              return (
                tags.includes(`invoice_card:${card.id}`) &&
                tags.includes(`invoice_cycle:${cycle.key}`)
              );
            })
            .reduce((s, p) => s + Number(p.amount), 0);

          const remaining = Math.max(0, total - paid);
          return {
            card: card.name,
            bank: card.bank,
            cycleKey: cycle.key,
            label: cycle.label,
            from: cycle.from,
            to: cycle.to,
            dueDay: card.due_day,
            total: Math.round(total * 100) / 100,
            paid: Math.round(paid * 100) / 100,
            remaining: Math.round(remaining * 100) / 100,
          };
        });

        return { count: invoices.length, invoices };
      },
    }),

    getEntreNos: tool({
      description:
        "Entre Nós: quem deve a quem no workspace compartilhado (acerto entre membros).",
      inputSchema: z.object({
        // Groq quebra com z.object({}) vazio
        detail: toolBool.describe("true = incluir histórico recente"),
      }),
      execute: async ({ detail }) => {
        const withDetail = asBool(detail, true);
        const { data: members, error: mErr } = await supabase
          .from("workspace_members")
          .select("id, display_name")
          .eq("workspace_id", workspaceId);
        if (mErr) return { error: mErr.message };
        if ((members ?? []).length < 2) {
          return {
            message:
              "Entre Nós precisa de workspace compartilhado com 2+ membros.",
          };
        }

        const { data: txs, error } = await supabase
          .from("transactions")
          .select(
            `
            id, amount, description, transaction_type, paid_by_member_id,
            consumer_member_id, transaction_date,
            category:categories(icon, name),
            cards(id, name, owner_member_id),
            accounts(id, name, owner_member_id)
          `
          )
          .eq("workspace_id", workspaceId)
          .in("transaction_type", ["expense", "loan_given", "settlement"])
          .neq("status", "cancelled")
          .order("transaction_date", { ascending: false })
          .limit(200);
        if (error) return { error: error.message };

        const settlement = computeEntreNosSettlement(
          members ?? [],
          (txs ?? []) as Parameters<typeof computeEntreNosSettlement>[1]
        );

        if (settlement.balanced || !settlement.debtor || !settlement.creditor) {
          return {
            balanced: true,
            message: "Estão quites (ou sem divisões pendentes).",
            balances: settlement.balances,
          };
        }

        return {
          balanced: false,
          summary: `${settlement.debtor.name} deve ${settlement.netAmount.toFixed(2)} a ${settlement.creditor.name}`,
          debtor: settlement.debtor,
          creditor: settlement.creditor,
          netAmount: settlement.netAmount,
          aPaidForB: settlement.aPaidForB,
          bPaidForA: settlement.bPaidForA,
          balances: settlement.balances,
          recent: withDetail ? settlement.recent : undefined,
        };
      },
    }),

    getMonthlyReport: tool({
      description:
        "Relatório do período: totais, por categoria, e visão de orçamento (gasto vs receita). Datas YYYY-MM-DD.",
      inputSchema: z.object({
        from: z.string(),
        to: z.string(),
      }),
      execute: async ({ from, to }) => {
        const { data, error } = await supabase
          .from("transactions")
          .select(
            "amount, transaction_type, category_id, categories(name, icon, type)"
          )
          .eq("workspace_id", workspaceId)
          .gte("transaction_date", from)
          .lte("transaction_date", to)
          .neq("status", "cancelled");
        if (error) return { error: error.message };

        let income = 0;
        let expense = 0;
        const byCategory = new Map<
          string,
          { name: string; type: string; total: number }
        >();

        for (const t of data ?? []) {
          const amt = Number(t.amount);
          const cat = t.categories as {
            name?: string;
            icon?: string;
            type?: string;
          } | null;
          if (
            t.transaction_type === "income" ||
            t.transaction_type === "loan_received"
          ) {
            income += amt;
          } else if (
            t.transaction_type === "expense" ||
            t.transaction_type === "loan_given"
          ) {
            expense += amt;
          } else {
            continue;
          }

          const key = t.category_id ?? "none";
          const name = cat?.name ?? "Sem categoria";
          const type =
            cat?.type ??
            (t.transaction_type === "income" ||
            t.transaction_type === "loan_received"
              ? "income"
              : "expense");
          const prev = byCategory.get(key) ?? { name, type, total: 0 };
          prev.total += amt;
          byCategory.set(key, prev);
        }

        const categories = Array.from(byCategory.values())
          .sort((a, b) => b.total - a.total)
          .slice(0, 15);

        return {
          from,
          to,
          income: Math.round(income * 100) / 100,
          expense: Math.round(expense * 100) / 100,
          net: Math.round((income - expense) * 100) / 100,
          byCategory: categories,
          tip: "Use esses totais como visão de orçamento do período (não há meta fixa cadastrada).",
        };
      },
    }),

    createTransaction: tool({
      description:
        "Cria lançamento (despesa ou receita). Sempre: 1) confirm=false → mostre preview + previewId; 2) confirm=true + MESMO previewId após o usuário confirmar.",
      inputSchema: z.object({
        description: z.string(),
        amount: z.number().positive(),
        type: z.enum(["expense", "income"]),
        paymentName: z
          .string()
          .describe("Nome do cartão ou da conta"),
        paymentKind: z.enum(["card", "account", "pix", "cash"]),
        date: z.string().optional().describe("YYYY-MM-DD; padrão = hoje"),
        categoryName: z.string().optional(),
        confirm: toolBool.describe("false = preview; true = gravar"),
        previewId: z
          .string()
          .optional()
          .describe("Obrigatório quando confirm=true"),
      }),
      execute: async ({
        description,
        amount,
        type,
        paymentName,
        paymentKind,
        date,
        categoryName,
        confirm,
        previewId,
      }) => {
        const doConfirm = asBool(confirm, false);
        const useCard = paymentKind === "card";
        let payment_method = "";
        let resolvedName = paymentName;

        if (useCard) {
          const { data: cards } = await supabase
            .from("cards")
            .select("id, name")
            .eq("workspace_id", workspaceId)
            .eq("is_active", true);
          const { match, ambiguous } = findByName(cards ?? [], paymentName);
          if (ambiguous.length)
            return { error: `Vários cartões: ${ambiguous.join(", ")}` };
          if (!match) return { error: `Cartão "${paymentName}" não encontrado` };
          payment_method = encodePaymentMethod("card", match.id);
          resolvedName = match.name;
        } else {
          const { data: accounts } = await supabase
            .from("accounts")
            .select("id, name")
            .eq("workspace_id", workspaceId)
            .eq("is_active", true);
          const { match, ambiguous } = findByName(
            accounts ?? [],
            paymentName
          );
          if (ambiguous.length)
            return { error: `Várias contas: ${ambiguous.join(", ")}` };
          if (!match)
            return { error: `Conta "${paymentName}" não encontrada` };
          payment_method = encodePaymentMethod("account", match.id);
          resolvedName = match.name;
        }

        const channel =
          paymentKind === "card"
            ? "card"
            : paymentKind === "pix"
              ? "pix"
              : paymentKind === "cash"
                ? "cash"
                : "account";

        const category_id = await resolveCategoryId(
          supabase,
          workspaceId,
          type,
          categoryName
        );

        const payload = {
          description,
          amount,
          type,
          date: date || toISODate(new Date()),
          payment: resolvedName,
          channel,
          payment_method,
          category_id,
          categoryName: categoryName ?? null,
        };

        if (!doConfirm) {
          const id = stashAiWritePreview({
            memberId: member.id,
            workspaceId,
            kind: "createTransaction",
            payload,
          });
          return {
            needsConfirmation: true,
            previewId: id,
            preview: {
              description: payload.description,
              amount: payload.amount,
              type: payload.type,
              date: payload.date,
              payment: payload.payment,
              channel: payload.channel,
              categoryName: payload.categoryName,
            },
            message:
              "Mostre o preview. Se o usuário confirmar, chame de novo com confirm=true e este previewId.",
          };
        }

        const gate = consumeAiWritePreview({
          previewId,
          memberId: member.id,
          workspaceId,
          kind: "createTransaction",
          payload,
        });
        if (!gate.ok) return { error: gate.error };

        const result = await createTransactionAction({
          description,
          amount,
          transaction_type: type,
          transaction_date: date || toISODate(new Date()),
          category_id,
          paid_by_member_id: member.id,
          consumer_member_id: member.id,
          payment_method,
          payment_channel: channel,
          notes: "Criado via Chat IA",
          is_installment: false,
          total_installments: null,
          third_party_name: null,
          third_party_relationship: null,
          transfer_to_account_id: null,
        });

        if ("error" in result && result.error) {
          return { error: result.error };
        }
        return {
          success: true,
          created: {
            description: payload.description,
            amount: payload.amount,
            type: payload.type,
            date: payload.date,
            payment: payload.payment,
          },
        };
      },
    }),

    payInvoice: tool({
      description:
        "Paga fatura do cartão (parcial ou total) debitando uma conta. confirm=false primeiro.",
      inputSchema: z.object({
        cardName: z.string(),
        accountName: z.string().describe("Conta de onde sai o dinheiro"),
        amount: z
          .number()
          .positive()
          .optional()
          .describe("Omitir = pagar o restante da fatura atual"),
        cycleKey: z.string().optional(),
        confirm: toolBool.describe("false = preview; true = pagar"),
        previewId: z.string().optional(),
      }),
      execute: async ({
        cardName,
        accountName,
        amount,
        cycleKey,
        confirm,
        previewId,
      }) => {
        const doConfirm = asBool(confirm, false);
        const { data: cards } = await supabase
          .from("cards")
          .select("id, name, closing_day, due_day")
          .eq("workspace_id", workspaceId)
          .eq("is_active", true);
        const cardFind = findByName(cards ?? [], cardName);
        if (cardFind.ambiguous.length)
          return { error: `Vários cartões: ${cardFind.ambiguous.join(", ")}` };
        if (!cardFind.match)
          return { error: `Cartão "${cardName}" não encontrado` };
        const card = cardFind.match;

        const { data: accounts } = await supabase
          .from("accounts")
          .select("id, name")
          .eq("workspace_id", workspaceId)
          .eq("is_active", true);
        const accFind = findByName(accounts ?? [], accountName);
        if (accFind.ambiguous.length)
          return { error: `Várias contas: ${accFind.ambiguous.join(", ")}` };
        if (!accFind.match)
          return { error: `Conta "${accountName}" não encontrada` };
        const account = accFind.match;

        const cycles = listInvoiceCycles(card.closing_day, card.due_day, {
          past: 4,
          future: 1,
        });
        const cycle =
          (cycleKey
            ? cycles.find((c) => c.key === cycleKey)
            : cycles.find((c) => c.isCurrent)) ??
          getCurrentInvoiceCycle(card);
        if (!cycle) return { error: "Ciclo não encontrado" };

        const { data: txs } = await supabase
          .from("transactions")
          .select("amount, transaction_type")
          .eq("workspace_id", workspaceId)
          .eq("card_id", card.id)
          .gte("transaction_date", cycle.from)
          .lte("transaction_date", cycle.to)
          .neq("status", "cancelled");
        const total = (txs ?? [])
          .filter((t) => t.transaction_type !== "income")
          .reduce((s, t) => s + Number(t.amount), 0);

        const { data: payments } = await supabase
          .from("transactions")
          .select("amount")
          .eq("workspace_id", workspaceId)
          .contains("tags", [
            "invoice_payment",
            `invoice_card:${card.id}`,
            `invoice_cycle:${cycle.key}`,
          ])
          .neq("status", "cancelled");
        const paid = (payments ?? []).reduce(
          (s, p) => s + Number(p.amount),
          0
        );
        const remaining = Math.max(0, total - paid);
        const payAmount = amount ?? remaining;

        if (payAmount <= 0) {
          return {
            error: "Nada a pagar neste ciclo (já quitado ou fatura zerada).",
            remaining,
            total,
            paid,
          };
        }

        const preview = {
          cardId: card.id,
          accountId: account.id,
          card: card.name,
          account: account.name,
          cycleKey: cycle.key,
          from: cycle.from,
          to: cycle.to,
          invoiceTotal: total,
          alreadyPaid: paid,
          remaining,
          payAmount,
        };

        if (!doConfirm) {
          const id = stashAiWritePreview({
            memberId: member.id,
            workspaceId,
            kind: "payInvoice",
            payload: preview,
          });
          return {
            needsConfirmation: true,
            previewId: id,
            preview: {
              card: preview.card,
              account: preview.account,
              cycleKey: preview.cycleKey,
              remaining: preview.remaining,
              payAmount: preview.payAmount,
            },
            message:
              "Confirme com o usuário e chame de novo com confirm=true + previewId.",
          };
        }

        const gate = consumeAiWritePreview({
          previewId,
          memberId: member.id,
          workspaceId,
          kind: "payInvoice",
          payload: preview,
        });
        if (!gate.ok) return { error: gate.error };

        const result = await payInvoiceAction({
          cardId: card.id,
          accountId: account.id,
          amount: payAmount,
          cycleKey: cycle.key,
          cycleFrom: cycle.from,
          cycleTo: cycle.to,
          cardName: card.name,
          paymentDate: toISODate(new Date()),
          notes: "Pago via Chat IA",
        });

        if ("error" in result && result.error) {
          return { error: result.error };
        }
        return { success: true, paid: preview };
      },
    }),

    createSubscription: tool({
      description:
        "Cadastra assinatura/recorrência. confirm=false primeiro para preview.",
      inputSchema: z.object({
        name: z.string(),
        amount: z.number().positive(),
        billingCycle: z.enum(["monthly", "yearly", "weekly"]).optional(),
        paymentName: z
          .string()
          .optional()
          .describe("Nome do cartão ou conta"),
        paymentKind: z.enum(["card", "account"]).optional(),
        nextBillingDate: z.string().optional(),
        confirm: toolBool.describe("false = preview; true = cadastrar"),
        previewId: z.string().optional(),
      }),
      execute: async ({
        name,
        amount,
        billingCycle = "monthly",
        paymentName,
        paymentKind = "card",
        nextBillingDate,
        confirm,
        previewId,
      }) => {
        const doConfirm = asBool(confirm, false);
        let card_id: string | null = null;
        let account_id: string | null = null;
        let paidWith: string | null = null;

        if (paymentName) {
          if (paymentKind === "card") {
            const { data: cards } = await supabase
              .from("cards")
              .select("id, name")
              .eq("workspace_id", workspaceId)
              .eq("is_active", true);
            const { match, ambiguous } = findByName(cards ?? [], paymentName);
            if (ambiguous.length)
              return { error: `Vários cartões: ${ambiguous.join(", ")}` };
            if (!match)
              return { error: `Cartão "${paymentName}" não encontrado` };
            card_id = match.id;
            paidWith = match.name;
          } else {
            const { data: accounts } = await supabase
              .from("accounts")
              .select("id, name")
              .eq("workspace_id", workspaceId)
              .eq("is_active", true);
            const { match, ambiguous } = findByName(
              accounts ?? [],
              paymentName
            );
            if (ambiguous.length)
              return { error: `Várias contas: ${ambiguous.join(", ")}` };
            if (!match)
              return { error: `Conta "${paymentName}" não encontrada` };
            account_id = match.id;
            paidWith = match.name;
          }
        }

        const preview = {
          name,
          amount,
          billingCycle,
          card_id,
          account_id,
          paidWith,
          nextBillingDate: nextBillingDate || null,
        };

        if (!doConfirm) {
          const id = stashAiWritePreview({
            memberId: member.id,
            workspaceId,
            kind: "createSubscription",
            payload: preview,
          });
          return {
            needsConfirmation: true,
            previewId: id,
            preview: {
              name: preview.name,
              amount: preview.amount,
              billingCycle: preview.billingCycle,
              paidWith: preview.paidWith,
              nextBillingDate: preview.nextBillingDate,
            },
            message:
              "Confirme com o usuário e chame de novo com confirm=true + previewId.",
          };
        }

        const gate = consumeAiWritePreview({
          previewId,
          memberId: member.id,
          workspaceId,
          kind: "createSubscription",
          payload: preview,
        });
        if (!gate.ok) return { error: gate.error };

        const result = await createSubscriptionAction({
          name,
          amount,
          billing_cycle: billingCycle,
          next_billing_date: nextBillingDate || null,
          card_id,
          account_id,
          category_id: null,
          notes: "Cadastrado via Chat IA",
        });

        if ("error" in result && result.error) {
          return { error: result.error };
        }
        return {
          success: true,
          created: {
            name: preview.name,
            amount: preview.amount,
            billingCycle: preview.billingCycle,
            paidWith: preview.paidWith,
          },
        };
      },
    }),

    batchCategorize: tool({
      description:
        "Categoriza em lote lançamentos sem categoria (despesa ou receita). confirm=false lista o preview; confirm=true aplica com IA.",
      inputSchema: z.object({
        type: z.enum(["expense", "income"]).optional(),
        limit: z.number().int().min(1).max(20).optional(),
        confirm: toolBool.describe("false = preview; true = aplicar"),
        previewId: z.string().optional(),
      }),
      execute: async ({ type = "expense", limit = 10, confirm, previewId }) => {
        const doConfirm = asBool(confirm, false);
        const { data: categories } = await supabase
          .from("categories")
          .select("id, name, icon")
          .eq("workspace_id", workspaceId)
          .eq("type", type);
        if (!categories?.length) {
          return { error: `Sem categorias do tipo ${type}` };
        }

        const { data: txs, error } = await supabase
          .from("transactions")
          .select("id, description, amount, transaction_date")
          .eq("workspace_id", workspaceId)
          .eq("transaction_type", type)
          .is("category_id", null)
          .neq("status", "cancelled")
          .order("transaction_date", { ascending: false })
          .limit(limit);
        if (error) return { error: error.message };
        if (!txs?.length) {
          return { message: "Nenhum lançamento sem categoria nesse filtro." };
        }

        const preview = {
          type,
          ids: txs.map((t) => t.id).sort(),
          items: txs.map((t) => ({
            id: t.id,
            description: t.description,
            amount: Number(t.amount),
            date: t.transaction_date,
          })),
        };

        if (!doConfirm) {
          const id = stashAiWritePreview({
            memberId: member.id,
            workspaceId,
            kind: "batchCategorize",
            payload: { type: preview.type, ids: preview.ids },
          });
          return {
            needsConfirmation: true,
            previewId: id,
            count: preview.items.length,
            preview: preview.items,
            message: `Há ${preview.items.length} lançamentos sem categoria. Confirme com confirm=true + previewId.`,
          };
        }

        const gate = consumeAiWritePreview({
          previewId,
          memberId: member.id,
          workspaceId,
          kind: "batchCategorize",
          payload: { type: preview.type, ids: preview.ids },
        });
        if (!gate.ok) return { error: gate.error };

        const ai = getAiLanguageModel("categorize");
        if (!ai.ok) return { error: ai.error, code: ai.code };

        const list = categories
          .map((c) => `${c.id} | ${c.icon ?? ""} ${c.name}`)
          .join("\n");

        const results: {
          id: string;
          description: string;
          categoryName: string | null;
          ok: boolean;
        }[] = [];

        for (const tx of txs) {
          try {
            const { object } = await generateObject({
              model: ai.model,
              maxRetries: 0,
              schema: z.object({
                categoryId: z.string(),
                categoryName: z.string(),
                confidence: z.number().min(0).max(1),
              }),
              system:
                type === "income"
                  ? "Categorização de RECEITAS no Brasil. Retorne JSON com categoryId da lista, categoryName e confidence."
                  : "Categorização de DESPESAS no Brasil. Retorne JSON com categoryId da lista, categoryName e confidence.",
              prompt: `Categorias:\n${list}\n\nDescrição: ${tx.description}\nValor: ${tx.amount}`,
            });

            let categoryId = object.categoryId;
            let categoryName = object.categoryName;
            const match = categories.find((c) => c.id === categoryId);
            if (!match) {
              const byName = categories.find(
                (c) =>
                  c.name.toLowerCase() === object.categoryName.toLowerCase()
              );
              if (!byName || object.confidence < 0.45) {
                results.push({
                  id: tx.id,
                  description: tx.description,
                  categoryName: null,
                  ok: false,
                });
                continue;
              }
              categoryId = byName.id;
              categoryName = byName.name;
            } else {
              categoryName = match.name;
            }

            const { error: upErr } = await supabase
              .from("transactions")
              .update({ category_id: categoryId })
              .eq("id", tx.id)
              .eq("workspace_id", workspaceId);
            results.push({
              id: tx.id,
              description: tx.description,
              categoryName: upErr ? null : categoryName,
              ok: !upErr,
            });
          } catch {
            results.push({
              id: tx.id,
              description: tx.description,
              categoryName: null,
              ok: false,
            });
          }
        }

        return {
          success: true,
          updated: results.filter((r) => r.ok).length,
          failed: results.filter((r) => !r.ok).length,
          results,
        };
      },
    }),

    suggestCategory: tool({
      description:
        "Sugere categoria para uma descrição (despesa ou receita), sem gravar.",
      inputSchema: z.object({
        description: z.string(),
        amount: z.number().optional(),
        type: z.enum(["expense", "income"]).optional(),
      }),
      execute: async ({ description, amount, type = "expense" }) => {
        const { data: categories } = await supabase
          .from("categories")
          .select("id, name, icon")
          .eq("workspace_id", workspaceId)
          .eq("type", type);
        if (!categories?.length) {
          return { error: `Sem categorias do tipo ${type}` };
        }

        const ai = getAiLanguageModel("categorize");
        if (!ai.ok) return { error: ai.error, code: ai.code };

        const list = categories
          .map((c) => `${c.id} | ${c.icon ?? ""} ${c.name}`)
          .join("\n");

        const { object } = await generateObject({
          model: ai.model,
          maxRetries: 0,
          schema: z.object({
            categoryId: z.string(),
            categoryName: z.string(),
            confidence: z.number().min(0).max(1),
          }),
          system:
            type === "income"
              ? "Sugira categoria de RECEITA. JSON: categoryId, categoryName, confidence."
              : "Sugira categoria de DESPESA. JSON: categoryId, categoryName, confidence.",
          prompt: `Categorias:\n${list}\n\nDescrição: ${description}\nValor: ${amount ?? "N/A"}`,
        });

        const match =
          categories.find((c) => c.id === object.categoryId) ??
          categories.find(
            (c) =>
              c.name.toLowerCase() === object.categoryName.toLowerCase()
          );
        if (!match) return { error: "Categoria inválida" };
        return {
          categoryId: match.id,
          categoryName: match.name,
          confidence: object.confidence,
        };
      },
    }),
  };
}

export type ChatTools = ReturnType<typeof buildChatTools>;

const WRITE_KEYS = [
  "createTransaction",
  "payInvoice",
  "createSubscription",
  "batchCategorize",
  "suggestCategory",
] as const;

const CORE_READ_KEYS = [
  "queryExpenses",
  "listCards",
  "listSubscriptions",
  "getAccountBalances",
  "getCardLimits",
  "getInvoiceCycles",
  "getEntreNos",
  "getMonthlyReport",
  "topCards",
  "openLoans",
] as const;

/** Menos tools = menos falhas no Groq ("Failed to call a function"). */
export function pickChatTools(
  all: ChatTools,
  userText: string,
  mode: "auto" | "core" | "minimal" = "auto"
): ChatTools {
  const text = userText.toLowerCase();
  const keep = new Set<string>();

  if (mode === "minimal") {
    for (const key of [
      "queryExpenses",
      "getAccountBalances",
      "getCardLimits",
      "getInvoiceCycles",
      "getEntreNos",
    ] as const) {
      keep.add(key);
    }
  } else {
    for (const key of CORE_READ_KEYS) keep.add(key);

    const wantsWrite =
      /\b(cria|criar|lan[cç]a|lancar|cadastr|pag(a|ar)|assinatur|categoriz|confirma|confirm)/i.test(
        text
      ) || /\b(sim|pode|faz|execute)\b/i.test(text);

    if (mode === "auto" && wantsWrite) {
      for (const key of WRITE_KEYS) keep.add(key);
    }

    if (
      mode === "auto" &&
      /\b(despesa|receita|gasto|compra)\b/i.test(text) &&
      /\b(no |na |cart[aã]o|conta|pix)\b/i.test(text)
    ) {
      keep.add("createTransaction");
    }
  }

  const out = { ...all };
  for (const key of Object.keys(out) as (keyof ChatTools)[]) {
    if (!keep.has(key)) {
      delete out[key];
    }
  }
  return out;
}

export function lastUserText(
  messages: { role: string; content: string }[]
): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === "user") return messages[i].content ?? "";
  }
  return "";
}
