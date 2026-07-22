"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { invalidateFinanceQueries } from "@/lib/finance/invalidate";

/**
 * Realtime: quando outro membro cria/edita lançamento, membro ou conta,
 * o app atualiza sem precisar fechar o atalho.
 */
export function WorkspaceRealtime({ workspaceId }: { workspaceId: string }) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!workspaceId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`ws-live:${workspaceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "transactions",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () => {
          invalidateFinanceQueries(qc);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "workspace_members",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () => {
          void qc.invalidateQueries({ queryKey: ["app-shell"] });
          void qc.invalidateQueries({ queryKey: ["workspace-members"] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "accounts",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () => {
          void qc.invalidateQueries({ queryKey: ["accounts"] });
          void qc.invalidateQueries({ queryKey: ["dashboard"] });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [workspaceId, qc]);

  return null;
}
