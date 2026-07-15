"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle, ChevronLeft, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/design-system";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const origin = window.location.origin;
    const { error: authError } = await supabase.auth.resetPasswordForEmail(
      email,
      { redirectTo: `${origin}/reset-password` }
    );
    setLoading(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    setSent(true);
  }

  return (
    <div className="flex min-h-screen flex-col bg-background px-6">
      <div className="flex items-center gap-3 py-3">
        <Link
          href="/login"
          className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--color-chip)]"
          aria-label="Voltar"
        >
          <ChevronLeft size={18} strokeWidth={2} className="text-foreground/70" />
        </Link>
      </div>

      <div className="flex flex-1 flex-col gap-8 pb-8 pt-6">
        {!sent ? (
          <>
            <div>
              <h2
                className="text-[26px] font-medium tracking-tight text-foreground"
                style={{ letterSpacing: "-0.025em" }}
              >
                Recuperar senha
              </h2>
              <p className="mt-1.5 text-sm text-foreground/35">
                Enviaremos um link para redefinir sua senha.
              </p>
            </div>
            <form onSubmit={onSubmit} className="flex flex-1 flex-col gap-3">
              <InputField
                label="E-mail"
                type="email"
                required
                autoComplete="email"
                placeholder="seu@email.com"
                icon={<Mail size={16} />}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="mt-auto pt-6">
                <Button
                  type="submit"
                  size="lg"
                  className="h-[52px] w-full text-[15px]"
                  disabled={loading}
                >
                  {loading ? "Enviando…" : "Enviar link"}
                </Button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-[10px] bg-[#F0FDF4]">
              <CheckCircle size={32} className="text-[#22C55E]" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-foreground">
                Link enviado!
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-foreground/35">
                Verifique sua caixa de entrada
                <br />e siga as instruções.
              </p>
            </div>
            <Link
              href="/login"
              className="mt-2 text-sm text-foreground/45 transition-colors hover:text-foreground/70"
            >
              Voltar ao login
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
