"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "sonner";
import { useUiStore } from "@/lib/stores/ui-store";
import { PwaRegister } from "@/components/shared/pwa-register";

function ThemeSync({ children }: { children: React.ReactNode }) {
  const theme = useUiStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    root.style.colorScheme = theme;
  }, [theme]);

  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            gcTime: 10 * 60_000,
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={client}>
      <NuqsAdapter>
        <ThemeSync>
          <PwaRegister />
          {children}
          <Toaster
            position="top-center"
            richColors
            closeButton
            toastOptions={{
              className:
                "!rounded-xl !border-[var(--color-fog)] !bg-[var(--color-white)] !text-[var(--color-ink)] !shadow-none",
            }}
          />
        </ThemeSync>
      </NuqsAdapter>
    </QueryClientProvider>
  );
}
