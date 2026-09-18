"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Category, WorkspaceMember } from "@/types";
import {
  Btn,
  DsSkeleton,
  EmptyState,
  TopBar,
} from "@/components/design-system";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MoneyInput } from "@/components/transactions/money-input";
import {
  useCategorizationRules,
  useCategories,
  useCategoryBudgets,
  useMonthCloses,
  useSavingsGoals,
} from "@/lib/hooks/use-planning";
import {
  closeMonthAction,
  contributeToGoalAction,
  createCategorizationRuleAction,
  createCategoryAction,
  createSavingsGoalAction,
  deleteCategorizationRuleAction,
  deleteCategoryAction,
  deleteCategoryBudgetAction,
  seedSuggestedRulesAction,
  upsertCategoryBudgetAction,
} from "@/lib/actions/planning";
import {
  formatCurrency,
  formatMonthYear,
  startOfMonth,
  toISODate,
  endOfMonth,
} from "@/lib/utils/format";
import { yearMonthOf } from "@/lib/finance/month-projection";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/ui/haptic";
import type { TransactionWithRelations } from "@/types";

type Tab = "budget" | "goals" | "rules" | "categories" | "close";

export function PlanningClient({ member }: { member: WorkspaceMember }) {
  const [tab, setTab] = useState<Tab>("budget");
  const tabs: { id: Tab; label: string }[] = [
    { id: "budget", label: "Orçamento" },
    { id: "goals", label: "Metas" },
    { id: "rules", label: "Regras" },
    { id: "categories", label: "Categorias" },
    { id: "close", label: "Fechar mês" },
  ];

  return (
    <div className="flex flex-col pb-4">
      <TopBar
        title="Planejamento"
        subtitle="Orçamento, metas, regras e fechamento"
        className="md:px-6"
      />
      <div className="page-enter page-pad space-y-5 md:px-6">
        <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium",
                tab === t.id
                  ? "bg-[var(--color-ink)] text-white dark:bg-[var(--color-pearl)] dark:text-[var(--color-ink)]"
                  : "bg-[var(--color-chip)] text-[var(--color-text-2)]"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        {tab === "budget" && <BudgetTab member={member} />}
        {tab === "goals" && <GoalsTab member={member} />}
        {tab === "rules" && <RulesTab member={member} />}
        {tab === "categories" && <CategoriesTab member={member} />}
        {tab === "close" && <CloseTab member={member} />}
      </div>
    </div>
  );
}

function BudgetTab({ member }: { member: WorkspaceMember }) {
  const qc = useQueryClient();
  const { data: categories = [], isLoading: catLoading } = useCategories(
    member.workspace_id
  );
  const { data: budgets = [], isLoading } = useCategoryBudgets(
    member.workspace_id
  );
  const now = useMemo(() => new Date(), []);
  const from = toISODate(startOfMonth(now));
  const to = toISODate(endOfMonth(now));

  const { data: monthTx = [] } = useQuery({
    queryKey: ["reports", member.workspace_id, from, to, "budget-spend"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("transactions")
        .select("amount, transaction_type, status, category_id")
        .eq("workspace_id", member.workspace_id)
        .gte("transaction_date", from)
        .lte("transaction_date", to)
        .neq("status", "cancelled");
      if (error) throw error;
      return data as Pick<
        TransactionWithRelations,
        "amount" | "transaction_type" | "status" | "category_id"
      >[];
    },
  });

  const spentByCat = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of monthTx) {
      if (tx.status === "scheduled") continue;
      if (
        tx.transaction_type !== "expense" &&
        tx.transaction_type !== "loan_given"
      ) {
        continue;
      }
      if (!tx.category_id) continue;
      map.set(tx.category_id, (map.get(tx.category_id) ?? 0) + Number(tx.amount));
    }
    return map;
  }, [monthTx]);

  const expenseCats = categories.filter((c) => c.type === "expense");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState(0);

  if (isLoading || catLoading) {
    return <DsSkeleton h="h-32" className="rounded-xl" />;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--color-text-2)]">
        Teto mensal por categoria. O gasto deste mês aparece na barra.
      </p>
      <form
        className="grid gap-3 rounded-[14px] border border-[var(--color-line)] bg-[var(--color-card)] p-4 sm:grid-cols-[1fr_8rem_auto]"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!categoryId || amount <= 0) {
            toast.error("Escolha a categoria e um valor");
            return;
          }
          const res = await upsertCategoryBudgetAction({
            category_id: categoryId,
            amount,
          });
          if (res.error) {
            toast.error(res.error);
            return;
          }
          toast.success("Orçamento salvo");
          setAmount(0);
          await qc.invalidateQueries({ queryKey: ["category-budgets"] });
        }}
      >
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger>
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            {expenseCats.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.icon} {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <MoneyInput value={amount} onValueChange={setAmount} />
        <Btn type="submit" size="sm">
          Salvar
        </Btn>
      </form>

      {budgets.length === 0 ? (
        <EmptyState
          scene="goal"
          title="Nenhum teto ainda"
          description="Defina quanto pode gastar em alimentação, lazer, etc."
        />
      ) : (
        <ul className="overflow-hidden rounded-[14px] border border-[var(--color-line)] bg-[var(--color-card)]">
          {budgets.map((b, i) => {
            const spent = spentByCat.get(b.category_id) ?? 0;
            const cap = Number(b.amount);
            const pct = cap > 0 ? Math.min(100, Math.round((spent / cap) * 100)) : 0;
            const over = spent > cap;
            return (
              <li
                key={b.id}
                className={cn(
                  "px-4 py-3.5",
                  i > 0 && "border-t border-[var(--color-line)]"
                )}
              >
                <div className="mb-2 flex items-center gap-3">
                  <span className="flex-1 text-[14px] font-medium">
                    {b.category?.icon} {b.category?.name ?? "Categoria"}
                  </span>
                  <span className="font-mono text-[12px] text-[var(--color-text-2)]">
                    {formatCurrency(spent)} / {formatCurrency(cap)}
                  </span>
                  <button
                    type="button"
                    className="text-[12px] text-[var(--color-text-3)] hover:text-[var(--color-expense)]"
                    onClick={async () => {
                      const res = await deleteCategoryBudgetAction(b.id);
                      if (res.error) toast.error(res.error);
                      else {
                        toast.success("Removido");
                        await qc.invalidateQueries({
                          queryKey: ["category-budgets"],
                        });
                      }
                    }}
                  >
                    tirar
                  </button>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-chip)]">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      over
                        ? "bg-[var(--color-expense)]"
                        : "bg-[var(--color-ink)]"
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {over ? (
                  <p className="mt-1 text-[11px] text-[var(--color-expense)]">
                    Estourou {formatCurrency(spent - cap)}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function GoalsTab({ member }: { member: WorkspaceMember }) {
  const qc = useQueryClient();
  const { data: goals = [], isLoading } = useSavingsGoals(member.workspace_id);
  const [name, setName] = useState("");
  const [target, setTarget] = useState(0);
  const [deadline, setDeadline] = useState("");
  const [contributeId, setContributeId] = useState<string | null>(null);
  const [contributeAmt, setContributeAmt] = useState(0);

  if (isLoading) return <DsSkeleton h="h-32" className="rounded-xl" />;

  const active = goals.filter((g) => g.is_active);

  return (
    <div className="space-y-4">
      <form
        className="space-y-3 rounded-[14px] border border-[var(--color-line)] bg-[var(--color-card)] p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const res = await createSavingsGoalAction({
            name,
            target_amount: target,
            deadline: deadline || null,
          });
          if (res.error) {
            toast.error(res.error);
            return;
          }
          toast.success("Meta criada");
          setName("");
          setTarget(0);
          await qc.invalidateQueries({ queryKey: ["savings-goals"] });
        }}
      >
        <div className="space-y-1">
          <Label>Nome</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Reserva, viagem, fundo de emergência"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Quanto guardar</Label>
            <MoneyInput value={target} onValueChange={setTarget} />
          </div>
          <div className="space-y-1">
            <Label>Até (opcional)</Label>
            <Input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
        </div>
        <Btn type="submit" size="sm">
          Criar meta
        </Btn>
      </form>

      {active.length === 0 ? (
        <EmptyState
          scene="goal"
          title="Nenhuma meta"
          description="Defina um valor e acompanhe o progresso."
        />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {active.map((g) => {
            const pct = Math.min(
              100,
              Math.round(
                (Number(g.current_amount) / Number(g.target_amount)) * 100
              )
            );
            return (
              <li
                key={g.id}
                className="rounded-[14px] border border-[var(--color-line)] bg-[var(--color-card)] p-4"
              >
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <p className="text-[14px] font-semibold">{g.name}</p>
                  <p className="font-mono text-[12px] text-[var(--color-text-2)]">
                    {formatCurrency(Number(g.current_amount))} /{" "}
                    {formatCurrency(Number(g.target_amount))}
                  </p>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-chip)]">
                  <div
                    className="h-full rounded-full bg-[var(--color-ink)]"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {g.deadline ? (
                  <p className="mt-1.5 text-[11px] text-[var(--color-text-2)]">
                    Até {g.deadline}
                  </p>
                ) : null}
                {contributeId === g.id ? (
                  <div className="mt-3 flex items-end gap-2">
                    <div className="min-w-0 flex-1">
                      <MoneyInput
                        value={contributeAmt}
                        onValueChange={setContributeAmt}
                      />
                    </div>
                    <Btn
                      size="sm"
                      onClick={async () => {
                        const res = await contributeToGoalAction({
                          goal_id: g.id,
                          amount: contributeAmt,
                        });
                        if (res.error) toast.error(res.error);
                        else {
                          toast.success("Valor adicionado");
                          setContributeId(null);
                          setContributeAmt(0);
                          await qc.invalidateQueries({
                            queryKey: ["savings-goals"],
                          });
                        }
                      }}
                    >
                      Guardar
                    </Btn>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="mt-2 text-[13px] font-medium text-[var(--color-text)] underline-offset-2 hover:underline"
                    onClick={() => setContributeId(g.id)}
                  >
                    Adicionar valor
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function RulesTab({ member }: { member: WorkspaceMember }) {
  const qc = useQueryClient();
  const { data: rules = [], isLoading } = useCategorizationRules(
    member.workspace_id
  );
  const { data: categories = [] } = useCategories(member.workspace_id);
  const [pattern, setPattern] = useState("");
  const [categoryId, setCategoryId] = useState("");

  if (isLoading) return <DsSkeleton h="h-32" className="rounded-xl" />;

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--color-text-2)]">
        Se a descrição contém o texto, a categoria é aplicada na hora — sem IA.
      </p>
      <Btn
        variant="secondary"
        size="sm"
        onClick={async () => {
          const res = await seedSuggestedRulesAction();
          if (res.error) toast.error(res.error);
          else {
            toast.success(
              res.added
                ? `${res.added} regras sugeridas`
                : "Nada novo para adicionar"
            );
            await qc.invalidateQueries({ queryKey: ["categorization-rules"] });
          }
        }}
      >
        Sugerir regras comuns (iFood, Uber…)
      </Btn>
      <form
        className="grid gap-3 rounded-[14px] border border-[var(--color-line)] bg-[var(--color-card)] p-4 sm:grid-cols-[1fr_1fr_auto]"
        onSubmit={async (e) => {
          e.preventDefault();
          const res = await createCategorizationRuleAction({
            pattern,
            category_id: categoryId,
          });
          if (res.error) {
            toast.error(res.error);
            return;
          }
          toast.success("Regra criada");
          setPattern("");
          await qc.invalidateQueries({ queryKey: ["categorization-rules"] });
        }}
      >
        <Input
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          placeholder="contém… (ex: ifood)"
        />
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger>
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.icon} {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Btn type="submit" size="sm">
          Adicionar
        </Btn>
      </form>
      {rules.length === 0 ? (
        <EmptyState
          scene="search"
          title="Nenhuma regra"
          description="Ex.: “ifood” → Alimentação."
        />
      ) : (
        <ul className="overflow-hidden rounded-[14px] border border-[var(--color-line)] bg-[var(--color-card)]">
          {rules.map((r, i) => (
            <li
              key={r.id}
              className={cn(
                "flex items-center gap-3 px-4 py-3",
                i > 0 && "border-t border-[var(--color-line)]"
              )}
            >
              <p className="min-w-0 flex-1 truncate text-[14px]">
                <span className="font-mono text-[13px]">{r.pattern}</span>
                <span className="text-[var(--color-text-2)]"> → </span>
                {r.category?.icon} {r.category?.name}
              </p>
              <button
                type="button"
                className="text-[12px] text-[var(--color-text-3)] hover:text-[var(--color-expense)]"
                onClick={async () => {
                  const res = await deleteCategorizationRuleAction(r.id);
                  if (res.error) toast.error(res.error);
                  else {
                    toast.success("Regra removida");
                    await qc.invalidateQueries({
                      queryKey: ["categorization-rules"],
                    });
                  }
                }}
              >
                apagar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CategoriesTab({ member }: { member: WorkspaceMember }) {
  const qc = useQueryClient();
  const { data: categories = [], isLoading } = useCategories(
    member.workspace_id
  );
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("📦");
  const [type, setType] = useState<Category["type"]>("expense");

  if (isLoading) return <DsSkeleton h="h-32" className="rounded-xl" />;

  return (
    <div className="space-y-4">
      <form
        className="grid gap-3 rounded-[14px] border border-[var(--color-line)] bg-[var(--color-card)] p-4 sm:grid-cols-[3rem_1fr_8rem_auto]"
        onSubmit={async (e) => {
          e.preventDefault();
          const res = await createCategoryAction({ name, icon, type });
          if (res.error) {
            toast.error(res.error);
            return;
          }
          toast.success("Categoria criada");
          setName("");
          await qc.invalidateQueries({ queryKey: ["categories"] });
        }}
      >
        <Input value={icon} onChange={(e) => setIcon(e.target.value)} />
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome"
        />
        <Select
          value={type}
          onValueChange={(v) => setType(v as Category["type"])}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="expense">Despesa</SelectItem>
            <SelectItem value="income">Receita</SelectItem>
          </SelectContent>
        </Select>
        <Btn type="submit" size="sm">
          Criar
        </Btn>
      </form>
      <ul className="overflow-hidden rounded-[14px] border border-[var(--color-line)] bg-[var(--color-card)]">
        {categories.map((c, i) => (
          <li
            key={c.id}
            className={cn(
              "flex items-center gap-3 px-4 py-3",
              i > 0 && "border-t border-[var(--color-line)]"
            )}
          >
            <span className="w-8 text-center text-base">{c.icon}</span>
            <span className="flex-1 text-[14px] font-medium">{c.name}</span>
            <span className="text-[11px] uppercase text-[var(--color-text-2)]">
              {c.type === "income" ? "receita" : "despesa"}
            </span>
            <button
              type="button"
              className="text-[12px] text-[var(--color-text-3)] hover:text-[var(--color-expense)]"
              onClick={async () => {
                if (!confirm(`Apagar ${c.name}? Lançamentos ficam sem categoria.`))
                  return;
                const res = await deleteCategoryAction(c.id);
                if (res.error) toast.error(res.error);
                else {
                  toast.success("Apagada");
                  await qc.invalidateQueries({ queryKey: ["categories"] });
                }
              }}
            >
              apagar
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CloseTab({ member }: { member: WorkspaceMember }) {
  const qc = useQueryClient();
  const now = useMemo(() => new Date(), []);
  const ym = yearMonthOf(now);
  const from = toISODate(startOfMonth(now));
  const to = toISODate(endOfMonth(now));
  const { data: closes = [] } = useMonthCloses(member.workspace_id);
  const already = closes.find((c) => c.year_month === ym);
  const [burst, setBurst] = useState(false);

  const { data: monthTx = [], isLoading } = useQuery({
    queryKey: ["reports", member.workspace_id, from, to, "close"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("transactions")
        .select("amount, transaction_type, status")
        .eq("workspace_id", member.workspace_id)
        .gte("transaction_date", from)
        .lte("transaction_date", to)
        .neq("status", "cancelled");
      if (error) throw error;
      return data as {
        amount: number;
        transaction_type: string;
        status: string;
      }[];
    },
  });

  const income = monthTx
    .filter(
      (t) =>
        t.status !== "scheduled" &&
        (t.transaction_type === "income" || t.transaction_type === "loan_received")
    )
    .reduce((s, t) => s + Number(t.amount), 0);
  const expenses = monthTx
    .filter(
      (t) =>
        t.status !== "scheduled" &&
        (t.transaction_type === "expense" || t.transaction_type === "loan_given")
    )
    .reduce((s, t) => s + Number(t.amount), 0);
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);

  if (isLoading) return <DsSkeleton h="h-32" className="rounded-xl" />;

  return (
    <div className="relative space-y-4">
      {burst ? (
        <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
          {[
            { l: "12%", d: "0ms" },
            { l: "28%", d: "40ms" },
            { l: "46%", d: "80ms" },
            { l: "62%", d: "30ms" },
            { l: "78%", d: "70ms" },
            { l: "88%", d: "20ms" },
          ].map((d) => (
            <span
              key={d.l}
              className="absolute top-8 h-1.5 w-1.5 rounded-full bg-[var(--color-ink)] dark:bg-[var(--color-pearl)]"
              style={{
                left: d.l,
                animation: `melza-burst 700ms ${d.d} ease-out forwards`,
              }}
            />
          ))}
          <div className="absolute inset-x-0 top-6 flex justify-center">
            <span className="rounded-full bg-[var(--color-ink)] px-3 py-1 text-[12px] font-medium text-white dark:bg-[var(--color-pearl)] dark:text-[var(--color-ink)]">
              Retrato salvo
            </span>
          </div>
        </div>
      ) : null}
      <div className="rounded-[14px] bg-[var(--color-hero)] px-5 py-5 text-[var(--color-hero-fg)]">
        <p className="text-[11px] uppercase tracking-wider text-[var(--color-silver)]">
          {formatMonthYear(now)}
        </p>
        <p className="mt-2 font-mono text-[22px] font-extrabold">
          {formatCurrency(income - expenses)}
        </p>
        <p className="mt-1 text-[12px] text-[var(--color-silver)]">
          Entradas {formatCurrency(income)} · Saídas {formatCurrency(expenses)}
        </p>
      </div>
      {already ? (
        <p className="text-sm text-[var(--color-text-2)]">
          Este mês já foi fechado em{" "}
          {new Date(already.closed_at).toLocaleString("pt-BR")}. Pode fechar de
          novo para atualizar o retrato.
        </p>
      ) : (
        <p className="text-sm text-[var(--color-text-2)]">
          Arquiva um retrato do mês. Não trava lançamentos — só marca o ritual.
        </p>
      )}
      <button
        type="button"
        onClick={() => setShowNotes((v) => !v)}
        className="text-left text-[13px] font-medium text-[var(--color-text-2)]"
      >
        {showNotes ? "Esconder anotação" : "Anotar algo (opcional)"}
      </button>
      {showNotes ? (
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ex.: fatura Inter em atraso"
          className="min-h-[72px] w-full rounded-[12px] border border-[var(--color-line)] bg-[var(--color-input)] px-3 py-2 text-sm"
        />
      ) : null}
      <Btn
        onClick={async () => {
          const res = await closeMonthAction({
            year_month: ym,
            income,
            expenses,
            notes,
          });
          if (res.error) toast.error(res.error);
          else {
            haptic("success");
            toast.success("Mês fechado");
            setBurst(true);
            window.setTimeout(() => setBurst(false), 900);
            await qc.invalidateQueries({ queryKey: ["month-closes"] });
          }
        }}
      >
        Fechar {formatMonthYear(now)}
      </Btn>
      {closes.length > 0 && (
        <ul className="overflow-hidden rounded-[14px] border border-[var(--color-line)] bg-[var(--color-card)]">
          {closes.map((c, i) => (
            <li
              key={c.id}
              className={cn(
                "flex items-center justify-between px-4 py-3 text-sm",
                i > 0 && "border-t border-[var(--color-line)]"
              )}
            >
              <span className="capitalize">
                {formatMonthYear(new Date(c.year_month + "-15T12:00:00"))}
              </span>
              <span className="font-mono text-[12px]">
                {formatCurrency(Number(c.income) - Number(c.expenses))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
