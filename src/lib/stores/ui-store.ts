"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type Theme = "dark" | "light";

interface UiState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  /** Dias de antecedência para alerta de assinatura */
  subscriptionAlertDays: number;
  setSubscriptionAlertDays: (days: number) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      theme: "dark",
      setTheme: (theme) => set({ theme }),
      toggleTheme: () =>
        set({ theme: get().theme === "dark" ? "light" : "dark" }),
      subscriptionAlertDays: 7,
      setSubscriptionAlertDays: (subscriptionAlertDays) =>
        set({ subscriptionAlertDays }),
    }),
    { name: "melza-ui" }
  )
);
