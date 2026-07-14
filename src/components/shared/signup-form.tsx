"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Lock, Mail, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { signupSchema, type SignupInput } from "@/lib/validations/auth";
import { activatePersonalWorkspaceAction } from "@/lib/actions/workspace";
import { Btn, InputField } from "@/components/design-system";

function safeRedirect(path: string | null): string {
  if (path && path.startsWith("/") && !path.startsWith("//")) return path;
  return "/onboarding";
}

export function SignupForm() {
  const searchParams = useSearchParams();
  const redirectTo = safeRedirect(searchParams.get("redirectTo"));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<SignupInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(signupSchema) as any,
    defaultValues: { email: "", password: "", displayName: "" },
  });

  async function onSubmit(values: SignupInput) {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signUp({
        email: values.email.trim(),
        password: values.password,
        options: {
          data: { display_name: values.displayName.trim() },
        },
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      await activatePersonalWorkspaceAction();
      window.location.assign(redirectTo);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Falha ao criar conta. Tente de novo."
      );
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background px-5 sm:px-6">
      <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col py-3">
        <div className="flex items-center gap-3 py-3">
          <Link
            href="/login"
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.06]"
            aria-label="Voltar"
          >
            <ChevronLeft
              size={18}
              strokeWidth={2}
              className="text-foreground/70"
            />
          </Link>
          <span className="text-sm text-foreground/60">Criar conta</span>
        </div>

        <div className="flex flex-1 flex-col gap-7 pb-8 pt-2 sm:gap-8 sm:pt-4">
          <div>
            <h2
              className="text-[26px] font-semibold tracking-tight text-foreground"
              style={{ letterSpacing: "-0.025em" }}
            >
              Bem-vindo ao Melza
            </h2>
            <p className="mt-1.5 text-sm text-foreground/35">
              Crie sua conta em 30 segundos.
            </p>
          </div>

          <form
            method="post"
            noValidate
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-1 flex-col gap-3"
          >
            <InputField
              label="Nome completo"
              autoComplete="name"
              placeholder="Matheus Santos"
              icon={<User size={16} />}
              error={form.formState.errors.displayName?.message}
              {...form.register("displayName")}
            />
            <InputField
              label="E-mail"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="seu@email.com"
              icon={<Mail size={16} />}
              error={form.formState.errors.email?.message}
              {...form.register("email")}
            />
            <InputField
              label="Senha"
              type="password"
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
              icon={<Lock size={16} />}
              hint="Use letras, números e símbolos."
              error={form.formState.errors.password?.message}
              {...form.register("password")}
            />
            {error && (
              <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <div className="mt-auto flex flex-col gap-3 pt-6">
              <Btn
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                disabled={loading}
              >
                {loading ? "Criando…" : "Criar conta"}
              </Btn>
              <p className="px-2 text-center text-xs leading-relaxed text-foreground/25 sm:px-4">
                Ao criar sua conta você concorda com os{" "}
                <Link
                  href="/terms"
                  className="text-foreground/45 underline underline-offset-2"
                >
                  Termos de Uso
                </Link>{" "}
                e{" "}
                <Link
                  href="/privacy"
                  className="text-foreground/45 underline underline-offset-2"
                >
                  Política de Privacidade
                </Link>
                .
              </p>
              <p className="text-center text-sm text-foreground/30">
                Já tem conta?{" "}
                <Link
                  href="/login"
                  className="font-medium text-foreground/65 hover:text-foreground/90"
                >
                  Entrar
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
