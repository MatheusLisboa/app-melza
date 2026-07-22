"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AppSidebar,
  MobileHeader,
  MobileNav,
} from "@/components/shared/app-nav";
import type { MembershipOption } from "@/components/shared/workspace-switcher";
import type { WorkspaceMember } from "@/types";
import { workspaceAccent, isSharedWorkspace } from "@/lib/utils/workspace";

type ShellData = {
  member: WorkspaceMember;
  memberships: MembershipOption[];
};

type ShellContextValue = ShellData & {
  refreshShell: () => Promise<void>;
};

const AppShellContext = createContext<ShellContextValue | null>(null);

async function fetchShell(): Promise<ShellData> {
  const res = await fetch("/api/shell", { credentials: "same-origin" });
  if (res.status === 401) {
    window.location.assign("/login");
    throw new Error("unauthenticated");
  }
  if (!res.ok) throw new Error("Falha ao carregar workspace");
  const body = (await res.json()) as ShellData;
  if (!body.member) {
    window.location.assign("/onboarding");
    throw new Error("no-member");
  }
  return body;
}

export function AppShellProvider({
  children,
  initialData,
}: {
  children: ReactNode;
  /** Seed do layout server — first paint sem esperar /api/shell */
  initialData?: ShellData;
}) {
  const qc = useQueryClient();
  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ["app-shell"],
    queryFn: fetchShell,
    initialData,
    // PWA na home screen fica aberto por dias — precisa refrescar membros/workspace
    staleTime: 30_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 1,
  });

  const refreshShell = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: ["app-shell"] });
    await qc.invalidateQueries({ queryKey: ["workspace-members"] });
  }, [qc]);

  // iOS PWA: ao voltar do background, atualiza membros (ex.: convite aceito)
  useEffect(() => {
    let hiddenAt = 0;
    const refreshLiveData = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      // Evita refetch em trocas rápidas de aba (<2s)
      if (hiddenAt && Date.now() - hiddenAt < 2_000) return;
      void qc.invalidateQueries({ queryKey: ["app-shell"] });
      void qc.invalidateQueries({ queryKey: ["workspace-members"] });
      void qc.invalidateQueries({ queryKey: ["entre-nos"] });
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        void qc.invalidateQueries({ queryKey: ["app-shell"] });
        void qc.invalidateQueries({ queryKey: ["workspace-members"] });
      }
    };
    document.addEventListener("visibilitychange", refreshLiveData);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("online", refreshLiveData);
    return () => {
      document.removeEventListener("visibilitychange", refreshLiveData);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("online", refreshLiveData);
    };
  }, [qc]);

  const value = useMemo<ShellContextValue | null>(() => {
    if (!data) return null;
    return { ...data, refreshShell };
  }, [data, refreshShell]);

  // Só bloqueia tela cheia se não veio seed do servidor
  if (isLoading && !initialData) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[var(--color-page)]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-pulse rounded-2xl bg-[var(--color-chip)]" />
          <p className="text-sm text-[var(--color-text-3)]">Carregando…</p>
        </div>
      </div>
    );
  }

  if ((isError && !data) || !value) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[var(--color-page)] px-6 text-center text-sm text-[var(--color-expense)]">
        Não foi possível carregar o app. Recarregue a página.
      </div>
    );
  }

  const wsColor = workspaceAccent(value.member.workspace?.type).color;
  const showEntreNos = isSharedWorkspace(value.member.workspace?.type);

  return (
    <AppShellContext.Provider value={value}>
      <div className="flex h-dvh overflow-hidden bg-[var(--color-page)]">
        <AppSidebar
          member={value.member}
          memberships={value.memberships}
        />
        <div className="mx-auto flex h-full min-h-0 w-full max-w-lg flex-1 flex-col overflow-hidden lg:mx-0 lg:max-w-none">
          <MobileHeader
            member={value.member}
            memberships={value.memberships}
          />
          {isFetching && !isLoading ? (
            <div
              className="h-0.5 w-full animate-pulse bg-[var(--color-chip)]"
              aria-hidden
            />
          ) : null}
          <main className="app-main min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
            {children}
          </main>
          <MobileNav wsColor={wsColor} showEntreNos={showEntreNos} />
        </div>
      </div>
    </AppShellContext.Provider>
  );
}

export function useAppShell(): ShellContextValue {
  const ctx = useContext(AppShellContext);
  if (!ctx) {
    throw new Error("useAppShell fora do AppShellProvider");
  }
  return ctx;
}
