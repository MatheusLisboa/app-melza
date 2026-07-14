import { z } from "zod";

export const subscriptionSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  amount: z.number().positive("Valor inválido"),
  billing_cycle: z.enum(["monthly", "yearly", "weekly"]),
  next_billing_date: z.string().optional().nullable(),
  card_id: z.string().uuid().optional().nullable(),
  account_id: z.string().uuid().optional().nullable(),
  category_id: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type SubscriptionInput = z.infer<typeof subscriptionSchema>;

export const loanSchema = z.object({
  direction: z.enum(["given", "received"]),
  third_party_name: z.string().min(1, "Informe o terceiro"),
  third_party_relationship: z.string().optional().nullable(),
  original_amount: z.number().positive("Valor inválido"),
  description: z.string().optional().nullable(),
  due_date: z.string().optional().nullable(),
  payment_method: z.string().optional().nullable(),
});

export type LoanInput = z.infer<typeof loanSchema>;

export const loanRepaymentSchema = z.object({
  loan_id: z.string().uuid(),
  amount: z.number().positive("Valor inválido"),
  payment_method: z.string().min(1, "Meio de pagamento"),
  transaction_date: z.string().min(1),
  notes: z.string().optional().nullable(),
});

export type LoanRepaymentInput = z.infer<typeof loanRepaymentSchema>;
