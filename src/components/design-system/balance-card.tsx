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
  accentColor: _accentColor,
  loading = false,
  trendLabel: _trendLabel,
  trendPositive: _trendPositive,
  title = "DISPONÍVEL",
  subtitle,
  className,
}: {
  balance: number;
  income: number;
  expenses: number;
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
        "relative overflow-hidden rounded-[16px] bg-[var(--color-hero)] px-5 py-5",
        className
      )}
    >
      <div
        className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full opacity-[0.07]"
        style={{ background: "#fff" }}
      />
      <div
        className="pointer-events-none absolute -bottom-16 -left-8 h-44 w-44 rounded-full opacity-[0.05]"
        style={{ background: "#fff" }}
      />

      <div className="relative mb-2 flex items-start justify-between gap-2">
        <div>
          <p
            className="text-[11px] font-medium uppercase text-[#8E8E93]"
            style={{ letterSpacing: "0.06em" }}
          >
            {title}
          </p>
          {subtitle ? (
            <p className="mt-0.5 text-[11px] text-[#636366]">{subtitle}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setHide((v) => !v)}
          className="rounded-lg p-1.5 text-[#8E8E93] transition-colors hover:bg-white/10 hover:text-white"
          aria-label={hide ? "Mostrar saldo" : "Ocultar saldo"}
        >
          {hide ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </button>
      </div>

      {loading ? (
        <div className="relative mb-3 h-9 w-48 animate-pulse rounded-md bg-[#2C2C2E]" />
      ) : (
        <p className="relative mb-3 font-mono text-[32px] font-extrabold leading-none tracking-tight text-[var(--color-hero-fg)] sm:text-[36px]">
          {hide ? "••••••" : formatCurrency(balance)}
        </p>
      )}

      <div className="relative mb-3 h-[3px] overflow-hidden rounded-full bg-[#2C2C2E]">
        <div
          className="h-full rounded-full bg-[#22C55E] transition-all duration-300 ease-out"
          style={{ width: `${loading ? 0 : progress}%` }}
        />
      </div>

      <div className="relative flex items-end justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-[#636366]">
            Entradas
          </div>
          <div className="mt-0.5 font-mono text-[13px] font-bold text-[#22C55E]">
            {loading ? "—" : hide ? "••••" : formatCurrency(income)}
          </div>
        </div>
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-wide text-[#636366]">
            Saldo do mês
          </div>
          <div
            className={cn(
              "mt-0.5 font-mono text-[13px] font-bold",
              loading
                ? "text-[#8E8E93]"
                : net >= 0
                  ? "text-[#22C55E]"
                  : "text-[#EF4444]"
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
          <div className="text-[10px] uppercase tracking-wide text-[#636366]">
            Saídas
          </div>
          <div className="mt-0.5 font-mono text-[13px] font-bold text-[#EF4444]">
            {loading ? "—" : hide ? "••••" : formatCurrency(expenses)}
          </div>
        </div>
      </div>
    </div>
  );
}
