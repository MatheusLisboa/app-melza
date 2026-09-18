"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/supabase/workspace";
import {
  categoryBudgetSchema,
  categorySchema,
  categorizationRuleSchema,
  goalContributeSchema,
  monthCloseSchema,
  savingsGoalSchema,
  type CategoryBudgetInput,
  type CategoryInput,
  type CategorizationRuleInput,
  type GoalContributeInput,
  type MonthCloseInput,
  type SavingsGoalInput,
} from "@/lib/validations/planning";
import { SUGGESTED_RULES } from "@/lib/finance/categorize-rules";

function revalidatePlanning() {
  revalidatePath("/planning");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  revalidatePath("/subscriptions");
}

export async function upsertCategoryBudgetAction(raw: CategoryBudgetInput) {
  const parsed = categoryBudgetSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  const member = await requireMember();
  const supabase = await createClient();
  const { error } = await supabase.from("category_budgets").upsert(
    {
      workspace_id: member.workspace_id,
      category_id: parsed.data.category_id,
      amount: parsed.data.amount,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "workspace_id,category_id" }
  );
  if (error) return { error: error.message };
  revalidatePlanning();
  return { success: true };
}

export async function deleteCategoryBudgetAction(id: string) {
  const member = await requireMember();
  const supabase = await createClient();
  const { error } = await supabase
    .from("category_budgets")
    .delete()
    .eq("id", id)
    .eq("workspace_id", member.workspace_id);
  if (error) return { error: error.message };
  revalidatePlanning();
  return { success: true };
}

export async function createCategorizationRuleAction(
  raw: CategorizationRuleInput
) {
  const parsed = categorizationRuleSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  const member = await requireMember();
  const supabase = await createClient();
  const { error } = await supabase.from("categorization_rules").insert({
    workspace_id: member.workspace_id,
    pattern: parsed.data.pattern.trim(),
    category_id: parsed.data.category_id,
  });
  if (error) return { error: error.message };
  revalidatePlanning();
  return { success: true };
}

export async function deleteCategorizationRuleAction(id: string) {
  const member = await requireMember();
  const supabase = await createClient();
  const { error } = await supabase
    .from("categorization_rules")
    .delete()
    .eq("id", id)
    .eq("workspace_id", member.workspace_id);
  if (error) return { error: error.message };
  revalidatePlanning();
  return { success: true };
}

export async function seedSuggestedRulesAction() {
  const member = await requireMember();
  const supabase = await createClient();
  const { data: categories, error: catError } = await supabase
    .from("categories")
    .select("id, name")
    .eq("workspace_id", member.workspace_id);
  if (catError) return { error: catError.message };

  const { data: existing } = await supabase
    .from("categorization_rules")
    .select("pattern")
    .eq("workspace_id", member.workspace_id);
  const have = new Set(
    (existing ?? []).map((r) => r.pattern.trim().toLowerCase())
  );

  const rows = SUGGESTED_RULES.flatMap((s) => {
    if (have.has(s.pattern.toLowerCase())) return [];
    const cat = categories?.find(
      (c) => c.name.toLowerCase() === s.categoryName.toLowerCase()
    );
    if (!cat) return [];
    return [
      {
        workspace_id: member.workspace_id,
        pattern: s.pattern,
        category_id: cat.id,
      },
    ];
  });

  if (rows.length === 0) {
    return { success: true, added: 0 };
  }

  const { error } = await supabase.from("categorization_rules").insert(rows);
  if (error) return { error: error.message };
  revalidatePlanning();
  return { success: true, added: rows.length };
}

export async function createCategoryAction(raw: CategoryInput) {
  const parsed = categorySchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  const member = await requireMember();
  const supabase = await createClient();
  const { error } = await supabase.from("categories").insert({
    workspace_id: member.workspace_id,
    name: parsed.data.name,
    icon: parsed.data.icon || null,
    type: parsed.data.type,
    color: parsed.data.type === "income" ? "#22c55e" : "#8e8e93",
  });
  if (error) return { error: error.message };
  revalidatePlanning();
  revalidatePath("/transactions");
  return { success: true };
}

export async function deleteCategoryAction(id: string) {
  const member = await requireMember();
  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", id)
    .eq("workspace_id", member.workspace_id);
  if (error) return { error: error.message };
  revalidatePlanning();
  return { success: true };
}

export async function createSavingsGoalAction(raw: SavingsGoalInput) {
  const parsed = savingsGoalSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  const member = await requireMember();
  const supabase = await createClient();
  const { error } = await supabase.from("savings_goals").insert({
    workspace_id: member.workspace_id,
    name: parsed.data.name,
    target_amount: parsed.data.target_amount,
    current_amount: parsed.data.current_amount ?? 0,
    deadline: parsed.data.deadline || null,
    account_id: parsed.data.account_id || null,
    is_active: true,
  });
  if (error) return { error: error.message };
  revalidatePlanning();
  return { success: true };
}

export async function contributeToGoalAction(raw: GoalContributeInput) {
  const parsed = goalContributeSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  const member = await requireMember();
  const supabase = await createClient();
  const { data: goal, error: gError } = await supabase
    .from("savings_goals")
    .select("id, current_amount")
    .eq("id", parsed.data.goal_id)
    .eq("workspace_id", member.workspace_id)
    .maybeSingle();
  if (gError || !goal) return { error: gError?.message ?? "Meta não encontrada" };

  const next = Number(goal.current_amount) + parsed.data.amount;
  const { error } = await supabase
    .from("savings_goals")
    .update({
      current_amount: next,
      updated_at: new Date().toISOString(),
    })
    .eq("id", goal.id)
    .eq("workspace_id", member.workspace_id);
  if (error) return { error: error.message };
  revalidatePlanning();
  return { success: true };
}

export async function toggleGoalAction(id: string, isActive: boolean) {
  const member = await requireMember();
  const supabase = await createClient();
  const { error } = await supabase
    .from("savings_goals")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("workspace_id", member.workspace_id);
  if (error) return { error: error.message };
  revalidatePlanning();
  return { success: true };
}

export async function closeMonthAction(raw: MonthCloseInput) {
  const parsed = monthCloseSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  const member = await requireMember();
  const supabase = await createClient();
  const { error } = await supabase.from("month_closes").upsert(
    {
      workspace_id: member.workspace_id,
      year_month: parsed.data.year_month,
      closed_by_member_id: member.id,
      income: parsed.data.income,
      expenses: parsed.data.expenses,
      notes: parsed.data.notes || null,
      closed_at: new Date().toISOString(),
    },
    { onConflict: "workspace_id,year_month" }
  );
  if (error) return { error: error.message };
  revalidatePlanning();
  return { success: true };
}

export async function attachReceiptAction(
  transactionId: string,
  receiptUrl: string
) {
  if (!receiptUrl.trim()) {
    return { error: "Comprovante inválido" };
  }
  const member = await requireMember();
  const supabase = await createClient();
  const { error } = await supabase
    .from("transactions")
    .update({ receipt_url: receiptUrl })
    .eq("id", transactionId)
    .eq("workspace_id", member.workspace_id);
  if (error) return { error: error.message };
  revalidatePath("/transactions");
  return { success: true };
}
