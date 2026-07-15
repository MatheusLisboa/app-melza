"use client";

import {
  createContext,
  useCallback,
  useContext,
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

export function AppShellProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["app-shell"],
    queryFn: fetchShell,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  });

  const refreshShell = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: ["app-shell"] });
  }, [qc]);

  const value = useMemo<ShellContextValue | null>(() => {
    if (!data) return null;
    return { ...data, refreshShell };
  }, [data, refreshShell]);

  if (isLoading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-pulse rounded-2xl bg-[var(--color-chip)]" />
          <p className="text-sm text-foreground/35">Carregando…</p>
        </div>
      </div>
    );
  }

  if (isError || !value) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background px-6 text-center text-sm text-destructive">
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
