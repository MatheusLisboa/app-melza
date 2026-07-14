import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});

export const signupSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
  displayName: z.string().min(2, "Informe seu nome"),
});

export const createWorkspaceSchema = z.object({
  workspaceName: z.string().min(2, "Nome do workspace"),
  displayName: z.string().min(2, "Seu nome"),
  avatarColor: z.string().optional(),
  workspaceType: z
    .enum(["COUPLE", "FAMILY", "SHARED"])
    .optional()
    .default("COUPLE"),
});

export const profileSchema = z.object({
  displayName: z.string().min(2, "Informe seu nome"),
  avatarColor: z.string().min(4),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
