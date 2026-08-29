"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { formatCurrency } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

/** Card hero Melza — ink, barra, Entradas | Saídas */
export function BalanceCard({
  balance,
  income,
  expenses,
  loading = false,
  title = "DISPONÍVEL",
  subtitle,
  className,
}: {
  balance: number;
  income: number;
  expenses: number;
  /** Aceito por compatibilidade; o hero Melza usa ink fixo. */
  accentColor?: string;
  loading?: boolean;
  trendLabel?: string;
  trendPositive?: boolean;
  title?: string;
  subtitle?: string;
  className?: string;
}) {
  const [hide, setHide] = useState(false);
  const progress =
    income > 0 ? Math.min(100, Math.round((expenses / income) * 100)) : 0;
  const net = income - expenses;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl bg-[var(--color-hero)] px-6 py-6 shadow-[var(--shadow-card)]",
        className
      )}
    >
      <div
        className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full opacity-[0.07]"
        style={{ background: "var(--color-hero-fg)" }}
      />
      <div
        className="pointer-events-none absolute -bottom-16 -left-8 h-44 w-44 rounded-full opacity-[0.05]"
        style={{ background: "var(--color-hero-fg)" }}
      />

      <div className="relative mb-2 flex items-start justify-between gap-2">
        <div>
          <p
            className="text-[11px] font-medium uppercase text-[var(--color-silver)]"
            style={{ letterSpacing: "0.06em" }}
          >
            {title}
          </p>
          {subtitle ? (
            <p className="mt-0.5 text-[11px] text-[var(--color-text-2)]">{subtitle}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setHide((v) => !v)}
          className="rounded-lg p-1.5 text-[var(--color-silver)] transition-colors hover:bg-white/10 hover:text-[var(--color-hero-fg)]"
          aria-label={hide ? "Mostrar saldo" : "Ocultar saldo"}
        >
          {hide ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </button>
      </div>

      {loading ? (
        <div className="relative mb-3 h-9 w-48 animate-pulse rounded-md bg-[var(--color-onyx)]" />
      ) : (
        <p className="relative mb-3 font-mono text-[32px] font-extrabold leading-none tracking-tight text-[var(--color-hero-fg)] sm:text-[36px]">
          {hide ? "••••••" : formatCurrency(balance)}
        </p>
      )}

      <div className="relative mb-3 h-[3px] overflow-hidden rounded-full bg-[var(--color-onyx)]">
        <div
          className="h-full rounded-full bg-[var(--color-income)] transition-all duration-300 ease-out"
          style={{ width: `${loading ? 0 : progress}%` }}
        />
      </div>

      <div className="relative flex items-end justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-2)]">
            Entradas
          </div>
          <div className="mt-0.5 font-mono text-[13px] font-bold text-[var(--color-income)]">
            {loading ? "—" : hide ? "••••" : formatCurrency(income)}
          </div>
        </div>
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-2)]">
            Saldo do mês
          </div>
          <div
            className={cn(
              "mt-0.5 font-mono text-[13px] font-bold",
              loading
                ? "text-[var(--color-silver)]"
                : net >= 0
                  ? "text-[var(--color-income)]"
                  : "text-[var(--color-expense)]"
            )}
          >
            {loading
              ? "—"
              : hide
                ? "••••"
                : `${net >= 0 ? "+" : ""}${formatCurrency(net)}`}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-2)]">
            Saídas
          </div>
          <div className="mt-0.5 font-mono text-[13px] font-bold text-[var(--color-expense)]">
            {loading ? "—" : hide ? "••••" : formatCurrency(expenses)}
          </div>
        </div>
      </div>
    </div>
  );
}
