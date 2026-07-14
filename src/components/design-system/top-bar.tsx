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
          className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.06] transition-colors hover:bg-white/[0.1]"
          aria-label="Voltar"
        >
          <ChevronLeft size={18} strokeWidth={2} className="text-foreground/70" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1
          className="truncate text-[17px] font-semibold leading-tight text-foreground/95"
          style={{ letterSpacing: "-0.015em" }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="mt-0.5 text-xs text-foreground/40">{subtitle}</p>
        )}
      </div>
      {rightEl}
    </div>
  );
}
