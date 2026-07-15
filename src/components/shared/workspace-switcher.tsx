"use client";

import { useState, useTransition } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { setActiveWorkspaceAction } from "@/lib/actions/workspace";
import { workspaceTypeLabel } from "@/lib/utils/workspace";
import type { Workspace, WorkspaceMember } from "@/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import Link from "next/link";

export type MembershipOption = WorkspaceMember & {
  workspace: Workspace | null;
};

export function WorkspaceSwitcher({
  member,
  memberships,
  compact = false,
}: {
  member: WorkspaceMember;
  memberships: MembershipOption[];
  compact?: boolean;
}) {
  const qc = useQueryClient();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const active = memberships.find((m) => m.id === member.id) ?? member;
  const workspace = active.workspace;
  const title = workspace?.name ?? "Workspace";
  const subtitle = workspaceTypeLabel(workspace?.type);

  function switchTo(workspaceId: string) {
    if (workspaceId === member.workspace_id) return;
    setError(null);
    startTransition(async () => {
      try {
        await setActiveWorkspaceAction(workspaceId);
        await qc.invalidateQueries({ queryKey: ["app-shell"] });
        const { invalidateFinanceQueries } = await import(
          "@/lib/finance/invalidate"
        );
        invalidateFinanceQueries(qc);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Falha ao trocar");
      }
    });
  }

  return (
    <div className={cn(compact ? "min-w-0" : "w-full")}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size={compact ? "sm" : "default"}
            disabled={pending}
            className={cn(
              "h-auto justify-between gap-2 px-2 py-1.5 font-normal",
              compact ? "max-w-[11rem]" : "w-full"
            )}
          >
            <span className="min-w-0 text-left">
              <span className="block truncate text-sm font-semibold">
                {compact ? title : "Melza"}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {compact ? subtitle : `${title} · ${subtitle}`}
              </span>
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
          {memberships.map((m) => {
            const selected = m.workspace_id === member.workspace_id;
            return (
              <DropdownMenuItem
                key={m.id}
                onClick={() => switchTo(m.workspace_id)}
                className="flex items-start justify-between gap-2"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm">
                    {m.workspace?.name ?? "Workspace"}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {workspaceTypeLabel(m.workspace?.type)}
                  </span>
                </span>
                {selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/settings#workspace" className="cursor-pointer">
              <Plus className="mr-2 h-4 w-4" />
              Novo workspace
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {error && <p className="mt-1 px-2 text-[11px] text-destructive">{error}</p>}
    </div>
  );
}
