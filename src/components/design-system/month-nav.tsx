"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  addMonths,
  formatMonthYear,
  startOfMonth,
} from "@/lib/utils/format";
import { cn } from "@/lib/utils";

export function MonthNav({
  value,
  onChange,
  minMonthsBack = 24,
  className,
}: {
  value: Date;
  onChange: (next: Date) => void;
  minMonthsBack?: number;
  className?: string;
}) {
  const today = startOfMonth(new Date());
  const current = startOfMonth(value);
  const isCurrent = current.getTime() === today.getTime();
  const oldest = addMonths(today, -minMonthsBack);
  const canPrev = current.getTime() > oldest.getTime();
  const canNext = current.getTime() < today.getTime();

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <button
        type="button"
        disabled={!canPrev}
        onClick={() => onChange(addMonths(current, -1))}
        className="touch-target flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] text-[var(--color-text)] transition-colors hover:bg-[var(--color-chip)] disabled:pointer-events-none disabled:opacity-30"
        aria-label="Mês anterior"
      >
        <ChevronLeft size={16} strokeWidth={2} />
      </button>

      <div className="min-w-0 flex-1 text-center">
        <p className="truncate text-[14px] font-semibold capitalize leading-tight text-[var(--color-text)]">
          {isCurrent ? "Este mês" : formatMonthYear(current)}
        </p>
        {isCurrent ? (
          <p className="mt-0.5 text-[11px] capitalize text-[var(--color-text-2)]">
            {formatMonthYear(current)}
          </p>
        ) : (
          <button
            type="button"
            onClick={() => onChange(today)}
            className="mt-0.5 text-[11px] font-medium text-[var(--color-text)] underline-offset-2 hover:underline"
          >
            Voltar ao mês atual
          </button>
        )}
      </div>

      <button
        type="button"
        disabled={!canNext}
        onClick={() => onChange(addMonths(current, 1))}
        className="touch-target flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] text-[var(--color-text)] transition-colors hover:bg-[var(--color-chip)] disabled:pointer-events-none disabled:opacity-30"
        aria-label="Próximo mês"
      >
        <ChevronRight size={16} strokeWidth={2} />
      </button>
    </div>
  );
}
