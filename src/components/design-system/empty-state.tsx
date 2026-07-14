"use client";

import { Btn } from "./btn";
import { cn } from "@/lib/utils";

/**
 * Make: EmptyState
 * Aceita aliases (description/actionLabel) para callers existentes.
 */
export function EmptyState({
  icon,
  title,
  desc,
  description,
  cta,
  actionLabel,
  onCta,
  onAction,
  wsColor,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  desc?: string;
  description?: string;
  cta?: string;
  actionLabel?: string;
  onCta?: () => void;
  onAction?: () => void;
  wsColor?: string;
  className?: string;
}) {
  const body = desc ?? description;
  const ctaLabel = cta ?? actionLabel;
  const handleCta = onCta ?? onAction;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 px-6 py-12 text-center",
        className
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.05] text-white/20">
        {icon ?? (
          <span className="text-xl opacity-40" aria-hidden>
            ◻
          </span>
        )}
      </div>
      <div>
        <p className="text-[15px] font-semibold text-white/80">{title}</p>
        {body && (
          <p className="mt-1 text-sm leading-relaxed text-white/35">{body}</p>
        )}
      </div>
      {ctaLabel && handleCta && (
        <Btn
          variant="secondary"
          size="sm"
          wsColor={wsColor}
          onClick={handleCta}
        >
          {ctaLabel}
        </Btn>
      )}
    </div>
  );
}
