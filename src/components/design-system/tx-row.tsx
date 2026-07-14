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
}: {
  emoji?: string | null;
  title: string;
  category?: string | null;
  dateLabel?: string;
  /** Ex.: "PIX · Nubank" ou "Cartão · Inter" */
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
}) {
  const showTrio = consumer && payer && cardOwner;
  const allSame =
    showTrio &&
    consumer.id === payer.id &&
    payer.id === cardOwner.id;

  const meta = [paymentLabel, category, dateLabel].filter(Boolean).join(" · ");

  const content = (
    <>
      <div className="flex h-10 w-10 shrink-0 select-none items-center justify-center rounded-xl bg-[#1C1C1F] text-lg">
        {emoji || "💸"}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[14px] font-medium text-foreground/90">
            {title}
          </span>
          {pending && (
            <span className="shrink-0 rounded-full bg-amber-400/10 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-amber-400/80">
              Pendente
            </span>
          )}
          {installments && (
            <span className="shrink-0 rounded-full bg-white/[0.05] px-1.5 py-px text-[9px] text-foreground/30">
              {installments.current}/{installments.total}x
            </span>
          )}
        </div>
        {showTrio && (
          <AttributionTrio
            consumer={consumer}
            payer={payer}
            cardOwner={cardOwner}
          />
        )}
        {(!showTrio || allSame) && meta && (
          <span className="text-xs text-foreground/30">{meta}</span>
        )}
      </div>
      <span
        className={cn(
          "shrink-0 font-mono text-[14px] font-semibold tabular-nums",
          type === "income" ? "text-emerald-500" : "text-foreground/75"
        )}
      >
        {type === "income" ? "+" : type === "expense" ? "−" : ""}
        {formatCurrency(amount)}
      </span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl px-1 py-3 text-left transition-colors hover:bg-white/[0.03]",
          className
        )}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-1 py-3",
        className
      )}
    >
      {content}
    </div>
  );
}
