import { Suspense } from "react";
import { SignupForm } from "@/components/shared/signup-form";

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
          Carregando…
        </main>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
