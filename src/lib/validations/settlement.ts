import { z } from "zod";

export const settlementSchema = z.object({
  amount: z.number().positive("Valor deve ser maior que zero"),
  /** Quem está pagando agora (devedor) */
  fromMemberId: z.string().uuid(),
  /** Quem recebe o acerto (credor) */
  toMemberId: z.string().uuid(),
  /** Conta de onde saiu o dinheiro (PIX/conta) */
  accountId: z.string().uuid(),
  paymentDate: z.string().min(1),
  notes: z.string().optional().nullable(),
  /** Canal: pix | account | cash — default pix */
  paymentChannel: z.enum(["pix", "account", "cash"]).optional().nullable(),
});

export type SettlementInput = z.infer<typeof settlementSchema>;
