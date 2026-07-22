import { z } from "zod";

export const paymentChannelSchema = z.enum(["card", "pix", "account", "cash"]);
export type PaymentChannel = z.infer<typeof paymentChannelSchema>;

export const transactionSchema = z
  .object({
    description: z.string().min(1, "Descrição obrigatória"),
    amount: z.number().positive("Valor deve ser maior que zero"),
    transaction_type: z.enum([
      "expense",
      "income",
      "transfer",
      "loan_given",
      "loan_received",
      "loan_repayment",
    ]),
    transaction_date: z.string().min(1),
    category_id: z.string().uuid().optional().nullable(),
    paid_by_member_id: z.string().uuid().optional().nullable(),
    consumer_member_id: z.string().uuid().optional().nullable(),
    /** 100 = valor integral; 50 = rateio 50/50 */
    consumer_share_percent: z.number().int().min(1).max(100).optional().default(100),
    payment_method: z.string().min(1, "Selecione o meio de pagamento"),
    payment_channel: paymentChannelSchema.optional().nullable(),
    notes: z.string().optional().nullable(),
    is_installment: z.boolean(),
    total_installments: z.number().int().min(2).max(48).nullable().optional(),
    third_party_name: z.string().optional().nullable(),
    third_party_relationship: z.string().optional().nullable(),
    transfer_to_account_id: z.string().uuid().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.is_installment && (!data.total_installments || data.total_installments < 2)) {
      ctx.addIssue({
        code: "custom",
        message: "Informe o número de parcelas",
        path: ["total_installments"],
      });
    }
    if (data.transaction_type === "transfer" && !data.transfer_to_account_id) {
      ctx.addIssue({
        code: "custom",
        message: "Conta de destino obrigatória",
        path: ["transfer_to_account_id"],
      });
    }
    if (
      (data.transaction_type === "loan_given" ||
        data.transaction_type === "loan_received") &&
      !data.third_party_name?.trim()
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Informe o terceiro",
        path: ["third_party_name"],
      });
    }
    if (
      data.transaction_type !== "transfer" &&
      data.payment_channel === "card" &&
      !data.payment_method.startsWith("card:")
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Selecione um cartão",
        path: ["payment_method"],
      });
    }
    if (
      data.transaction_type !== "transfer" &&
      (data.payment_channel === "pix" ||
        data.payment_channel === "account" ||
        data.payment_channel === "cash") &&
      !data.payment_method.startsWith("account:")
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Selecione uma conta",
        path: ["payment_method"],
      });
    }
  });

export type TransactionInput = z.infer<typeof transactionSchema>;
