import { z } from "zod";

export const categoryBudgetSchema = z.object({
  category_id: z.string().uuid(),
  amount: z.number().min(0, "Valor inválido"),
});
export type CategoryBudgetInput = z.infer<typeof categoryBudgetSchema>;

export const categorizationRuleSchema = z.object({
  pattern: z.string().trim().min(2, "Pelo menos 2 caracteres").max(80),
  category_id: z.string().uuid(),
});
export type CategorizationRuleInput = z.infer<typeof categorizationRuleSchema>;

export const savingsGoalSchema = z.object({
  name: z.string().trim().min(1, "Nome obrigatório").max(80),
  target_amount: z.number().positive("Meta precisa ser maior que zero"),
  current_amount: z.number().min(0).optional(),
  deadline: z.string().optional().nullable(),
  account_id: z.string().uuid().optional().nullable(),
});
export type SavingsGoalInput = z.infer<typeof savingsGoalSchema>;

export const goalContributeSchema = z.object({
  goal_id: z.string().uuid(),
  amount: z.number().positive("Valor inválido"),
});
export type GoalContributeInput = z.infer<typeof goalContributeSchema>;

export const monthCloseSchema = z.object({
  year_month: z.string().regex(/^\d{4}-\d{2}$/, "Use AAAA-MM"),
  income: z.number(),
  expenses: z.number(),
  notes: z.string().max(500).optional().nullable(),
});
export type MonthCloseInput = z.infer<typeof monthCloseSchema>;

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Nome obrigatório").max(40),
  icon: z.string().trim().max(8).optional().nullable(),
  type: z.enum(["expense", "income", "transfer"]),
});
export type CategoryInput = z.infer<typeof categorySchema>;
