"use client";

import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Eye,
  EyeOff,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { MoneyDisplay } from "@/components/design-system/money-display";
import { DsSkeleton } from "@/components/design-system/skeleton";
import { formatCurrency } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

/** Card de saldo do dashboard — layout Figma PersonalDashboard */
export function BalanceCard({
  balance,
  income,
  expenses,
  accentColor = "hsl(var(--primary))",
  loading = false,
  trendLabel,
  trendPositive,
  title = "Nas contas",
  subtitle = "Dinheiro disponível em contas",
  className,
}: {
  balance: number;
  income: number;
  expenses: number;
  accentColor?: string;
  loading?: boolean;
  /** Ex.: resultado do mês (receitas − despesas) */
  trendLabel?: string;
  trendPositive?: boolean;
  title?: string;
  subtitle?: string;
  className?: string;
}) {
  const [hide, setHide] = useState(false);
  const saved = income - expenses;
  const trendOk = trendPositive ?? saved >= 0;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl p-6 animate-fade-up",
        className
      )}
      style={{
        background: `linear-gradient(135deg, ${accentColor}28 0%, ${accentColor}08 60%, transparent 100%)`,
        border: `1px solid ${accentColor}25`,
      }}
    >
      <div
        className="absolute right-0 top-0 h-40 w-40 rounded-full opacity-20 blur-3xl"
        style={{
          background: accentColor,
          transform: "translate(30%, -30%)",
        }}
      />
      <p className="mb-1 text-xs font-medium uppercase tracking-wider text-foreground/40">
        {title}
      </p>
      {subtitle && (
        <p className="mb-3 text-[11px] text-foreground/30">{subtitle}</p>
      )}
      {loading ? (
        <DsSkeleton h="h-9" w="w-48" className="rounded-xl" />
      ) : (
        <div className="flex items-center gap-3">
          {hide ? (
            <span className="text-[32px] font-semibold tracking-widest text-foreground/30">
              ••••••
            </span>
          ) : (
            <MoneyDisplay
              amount={balance}
              size="xl"
              color={balance < 0 ? "#EF4444" : undefined}
            />
          )}
          <button
            type="button"
            onClick={() => setHide((v) => !v)}
            className="mt-1 text-foreground/25 transition-colors hover:text-foreground/50"
            aria-label={hide ? "Mostrar saldo" : "Ocultar saldo"}
          >
            {hide ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
        </div>
      )}
      {!loading && trendLabel && (
        <div className="mt-2 flex items-center gap-1.5">
          {trendOk ? (
            <TrendingUp className="h-3.5 w-3.5 text-success" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5 text-destructive" />
          )}
          <span
            className={cn(
              "text-xs font-medium",
              trendOk ? "text-success" : "text-destructive"
            )}
          >
            {trendLabel}
          </span>
        </div>
      )}

      <div className="mt-6 flex gap-3 border-t border-foreground/[0.07] pt-4">
        {loading
          ? [1, 2, 3].map((i) => (
              <DsSkeleton key={i} h="h-10" className="flex-1 rounded-xl" />
            ))
          : [
              {
                label: "Receitas",
                value: income,
                color: "#22C55E",
                icon: ArrowDownLeft,
              },
              {
                label: "Despesas",
                value: expenses,
                color: "#EF4444",
                icon: ArrowUpRight,
              },
              {
                label: "Resultado",
                value: saved,
                color: accentColor,
                icon: Wallet,
              },
            ].map(({ label, value, color, icon: Icon }) => (
              <div key={label} className="flex-1">
                <div className="mb-1 flex items-center gap-1">
                  <Icon className="h-3 w-3" style={{ color }} />
                  <span className="text-[10px] font-medium text-foreground/35">
                    {label}
                  </span>
                </div>
                <span className="font-money text-[13px] font-semibold text-foreground/80">
                  {formatCurrency(value)}
                </span>
              </div>
            ))}
      </div>
    </div>
  );
}
