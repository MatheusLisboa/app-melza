"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Account, Card, WorkspaceMember } from "@/types";
import type { AccountInput, CardInput } from "@/lib/validations/card";

export function useWorkspaceMembers(workspaceId: string) {
  return useQuery({
    queryKey: ["workspace-members", workspaceId],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("workspace_members")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at");
      if (error) throw error;
      return data as WorkspaceMember[];
    },
  });
}

export function useCards(workspaceId: string) {
  return useQuery({
    queryKey: ["cards", workspaceId],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("cards")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at");
      if (error) throw error;
      return data as Card[];
    },
  });
}

export function useAccounts(workspaceId: string) {
  return useQuery({
    queryKey: ["accounts", workspaceId],
    staleTime: 2 * 60_000,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at");
      if (error) throw error;
      return data as Account[];
    },
  });
}

export function useCardMutations(workspaceId: string) {
  const qc = useQueryClient();
  const supabase = createClient();

  const create = useMutation({
    mutationFn: async (input: CardInput) => {
      const { data, error } = await supabase
        .from("cards")
        .insert({ ...input, workspace_id: workspaceId })
        .select()
        .single();
      if (error) throw error;
      return data as Card;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cards", workspaceId] }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...input }: CardInput & { id: string }) => {
      const { data, error } = await supabase
        .from("cards")
        .update(input)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Card;
    },
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ["cards", workspaceId] });
      void qc.invalidateQueries({ queryKey: ["card", data.id] });
    },
  });

  const deactivate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("cards")
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cards", workspaceId] }),
  });

  return { create, update, deactivate };
}

export function useAccountMutations(workspaceId: string) {
  const qc = useQueryClient();
  const supabase = createClient();

  const create = useMutation({
    mutationFn: async (input: AccountInput) => {
      const { data, error } = await supabase
        .from("accounts")
        .insert({ ...input, workspace_id: workspaceId })
        .select()
        .single();
      if (error) throw error;
      return data as Account;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["accounts", workspaceId] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, ...input }: AccountInput & { id: string }) => {
      const { data, error } = await supabase
        .from("accounts")
        .update(input)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Account;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["accounts", workspaceId] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const deactivate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("accounts")
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["accounts", workspaceId] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  return { create, update, deactivate };
}
