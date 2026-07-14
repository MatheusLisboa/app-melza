"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Account, Card, WorkspaceMember } from "@/types";
import type { AccountInput, CardInput } from "@/lib/validations/card";

export function useWorkspaceMembers(workspaceId: string) {
  return useQuery({
    queryKey: ["workspace-members", workspaceId],
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cards", workspaceId] }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounts", workspaceId] }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounts", workspaceId] }),
  });

  const deactivate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("accounts")
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounts", workspaceId] }),
  });

  return { create, update, deactivate };
}
