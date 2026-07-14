"use client";

import { LoginForm } from "@/components/shared/login-form";

/** Sem Suspense boundary — evita tela só com “Carregando…” se o JS demorar. */
export default function LoginPage() {
  return <LoginForm />;
}
