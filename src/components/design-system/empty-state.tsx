"use client";

import { Btn } from "./btn";
import { cn } from "@/lib/utils";

/**
 * Melza EmptyState
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
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-chip)] text-[var(--color-text-2)] shadow-card dark:shadow-card-dark">
        {icon ?? (
          <span className="text-xl opacity-60" aria-hidden>
            ◻
          </span>
        )}
      </div>
      <div>
        <p className="text-subtitle">{title}</p>
        {body && (
          <p className="mt-1.5 text-body text-[var(--color-text-2)]">{body}</p>
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
