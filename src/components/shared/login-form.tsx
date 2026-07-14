"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { BrandWordmark, Btn, InputField } from "@/components/design-system";

function safeRedirect(path: string | null): string {
  if (path && path.startsWith("/") && !path.startsWith("//")) return path;
  return "/dashboard";
}

export function LoginForm() {
  const [redirectTo, setRedirectTo] = useState("/dashboard");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    setRedirectTo(safeRedirect(sp.get("redirectTo")));
    const err = sp.get("error");
    if (err === "auth_callback") {
      setError("Não foi possível concluir o login. Tente de novo.");
    } else if (err === "missing_env") {
      setError(
        "Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no Vercel (Settings → Environment Variables) e faça redeploy."
      );
    }
  }, []);

  const form = useForm<LoginInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(loginSchema) as any,
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: values.email.trim(),
        password: values.password,
      });

      if (authError) {
        setError(
          authError.message === "Invalid login credentials"
            ? "E-mail ou senha inválidos."
            : authError.message
        );
        setLoading(false);
        return;
      }

      // Hard nav garante cookie da sessão no middleware
      window.location.assign(redirectTo);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Falha ao entrar. Verifique a conexão e tente de novo."
      );
      setLoading(false);
    }
  }

  const signupHref = `/signup${
    redirectTo !== "/dashboard"
      ? `?redirectTo=${encodeURIComponent(redirectTo)}`
      : ""
  }`;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background px-5 sm:px-6">
      <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center gap-7 py-10 sm:gap-8 sm:py-12">
        <div className="flex flex-col items-center gap-3 pb-1">
          <BrandWordmark size="md" />
          <p className="text-center text-sm text-foreground/35">
            Finanças que fazem sentido.
          </p>
        </div>

        <form
          method="post"
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-3"
          noValidate
        >
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
            type={showPass ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            icon={<Lock size={16} />}
            error={form.formState.errors.password?.message}
            rightEl={
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                aria-label={showPass ? "Ocultar senha" : "Mostrar senha"}
                className="flex items-center justify-center p-1"
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            }
            {...form.register("password")}
          />
          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              className="py-1 text-xs text-foreground/35 transition-colors hover:text-foreground/60"
            >
              Esqueceu a senha?
            </Link>
          </div>
          {error && (
            <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <Btn
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            disabled={loading}
            className="mt-1"
          >
            {loading ? "Entrando…" : "Entrar"}
          </Btn>
        </form>

        <p className="text-center text-sm text-foreground/30">
          Não tem conta?{" "}
          <Link
            href={signupHref}
            className="font-medium text-foreground/65 transition-colors hover:text-foreground/90"
          >
            Criar conta
          </Link>
        </p>
        <p className="text-center text-xs text-foreground/25">
          <Link href="/terms" className="hover:underline">
            Termos
          </Link>
          {" · "}
          <Link href="/privacy" className="hover:underline">
            Privacidade
          </Link>
        </p>
      </div>
    </div>
  );
}
