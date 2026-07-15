"use client";

import { AttributionTrio, type AttributionMember } from "./attribution-trio";
import { formatCurrency } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

export function TxRow({
  emoji,
  title,
  category,
  dateLabel,
  paymentLabel,
  amount,
  type,
  pending,
  installments,
  consumer,
  payer,
  cardOwner,
  onClick,
  className,
  embedded = false,
}: {
  emoji?: string | null;
  title: string;
  category?: string | null;
  dateLabel?: string;
  paymentLabel?: string | null;
  amount: number;
  type: "income" | "expense" | "other";
  pending?: boolean;
  installments?: { current: number; total: number } | null;
  consumer?: AttributionMember | null;
  payer?: AttributionMember | null;
  cardOwner?: AttributionMember | null;
  onClick?: () => void;
  className?: string;
  embedded?: boolean;
}) {
  const showTrio = Boolean(consumer && payer && cardOwner);
  const allSame =
    showTrio &&
    consumer!.id === payer!.id &&
    payer!.id === cardOwner!.id;

  const meta = [paymentLabel, category, dateLabel].filter(Boolean).join(" · ");
  const initial = (
    title.trim().charAt(0) ||
    category?.trim().charAt(0) ||
    "?"
  ).toUpperCase();
  const iconLabel = emoji?.trim() || initial;

  const sign =
    type === "income" ? "+" : type === "expense" ? "−" : "";
  const valueColor =
    type === "income"
      ? "text-[#22C55E]"
      : type === "expense"
        ? "text-[#EF4444]"
        : "text-[var(--color-text-2)]";

  const content = (
    <>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-icon)] text-[13px] font-bold text-white">
        {iconLabel}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-[var(--color-text)]">
            {title}
          </span>
          {pending && (
            <span className="shrink-0 rounded-full bg-[#FEF9EE] px-2.5 py-0.5 text-[11px] font-semibold text-[#92400E] dark:bg-[#3A2A10] dark:text-[#FBBF24]">
              Pendente
            </span>
          )}
          {installments && (
            <span className="shrink-0 rounded-full bg-[var(--color-ink)] px-2.5 py-0.5 text-[11px] font-semibold text-white dark:bg-[var(--color-chip)] dark:text-[#111]">
              {installments.current}/{installments.total}
            </span>
          )}
        </div>
        {showTrio && (
          <AttributionTrio
            consumer={consumer!}
            payer={payer!}
            cardOwner={cardOwner!}
          />
        )}
        {(!showTrio || allSame) && meta ? (
          <span className="text-xs text-[var(--color-text-2)]">{meta}</span>
        ) : null}
      </div>
      <span
        className={cn(
          "shrink-0 font-mono text-sm font-bold tabular-nums",
          valueColor
        )}
      >
        {sign}
        {formatCurrency(amount)}
      </span>
    </>
  );

  const base = cn(
    "flex w-full items-center gap-3 px-4 py-3 text-left",
    embedded
      ? "rounded-none border-0 bg-transparent"
      : "mb-1.5 rounded-xl border border-[var(--color-line)] bg-[var(--color-card)]",
    !embedded && "hover:bg-[var(--color-chip)]",
    className
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={base}>
        {content}
      </button>
    );
  }

  return <div className={base}>{content}</div>;
}
