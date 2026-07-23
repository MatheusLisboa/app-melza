"use client";

import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export function TopBar({
  title,
  subtitle,
  onBack,
  rightEl,
  className,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightEl?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-3 px-5 py-3",
        className
      )}
    >
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="touch-target flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] transition-colors hover:bg-[var(--color-chip)]"
          aria-label="Voltar"
        >
          <ChevronLeft
            size={18}
            strokeWidth={2}
            className="text-[var(--color-text)]"
          />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1
          className="truncate text-[17px] font-bold leading-tight text-[var(--color-text)]"
          style={{ letterSpacing: "-0.015em" }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="mt-0.5 text-xs text-[var(--color-text-2)]">{subtitle}</p>
        )}
      </div>
      {rightEl}
    </div>
  );
}
