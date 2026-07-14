import { Suspense } from "react";
import { LoginForm } from "@/components/shared/login-form";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
          Carregando…
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
