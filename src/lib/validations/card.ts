import { z } from "zod";

export const cardSchema = z.object({
  name: z.string().min(2, "Nome obrigatório"),
  bank: z.string().min(1, "Banco obrigatório"),
  last_four: z.string().max(4).optional().nullable(),
  card_type: z.enum(["credit", "debit"]),
  color: z.string().min(4),
  owner_member_id: z.string().uuid().optional().nullable(),
  closing_day: z.number().int().min(1).max(31).nullable().optional(),
  due_day: z.number().int().min(1).max(31).nullable().optional(),
  credit_limit: z.number().min(0).nullable().optional(),
});

export const accountSchema = z.object({
  name: z.string().min(2, "Nome obrigatório"),
  account_type: z.enum(["checking", "savings", "cash", "investment"]),
  bank: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  owner_member_id: z.string().uuid().optional().nullable(),
  current_balance: z.number().nullable().optional(),
});

export type CardInput = z.infer<typeof cardSchema>;
export type AccountInput = z.infer<typeof accountSchema>;
