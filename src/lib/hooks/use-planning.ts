"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type {
  Category,
  CategoryBudget,
  CategorizationRule,
  MonthClose,
  SavingsGoal,
} from "@/types";

export function useCategories(workspaceId: string) {
  return useQuery({
    queryKey: ["categories", workspaceId],
    staleTime: 10 * 60_000,
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("type")
        .order("name");
      if (error) throw error;
      return data as Category[];
    },
  });
}

export function useCategoryBudgets(workspaceId: string) {
  return useQuery({
    queryKey: ["category-budgets", workspaceId],
    staleTime: 30_000,
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("category_budgets")
        .select("*, category:categories(id, name, icon, color, type)")
        .eq("workspace_id", workspaceId)
        .order("created_at");
      if (error) throw error;
      return data as CategoryBudget[];
    },
  });
}

export function useCategorizationRules(workspaceId: string) {
  return useQuery({
    queryKey: ["categorization-rules", workspaceId],
    staleTime: 60_000,
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("categorization_rules")
        .select("*, category:categories(id, name, icon)")
        .eq("workspace_id", workspaceId)
        .order("created_at");
      if (error) throw error;
      return data as CategorizationRule[];
    },
  });
}

export function useSavingsGoals(workspaceId: string) {
  return useQuery({
    queryKey: ["savings-goals", workspaceId],
    staleTime: 30_000,
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("savings_goals")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as SavingsGoal[];
    },
  });
}

export function useMonthCloses(workspaceId: string) {
  return useQuery({
    queryKey: ["month-closes", workspaceId],
    staleTime: 60_000,
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("month_closes")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("year_month", { ascending: false })
        .limit(24);
      if (error) throw error;
      return data as MonthClose[];
    },
  });
}
