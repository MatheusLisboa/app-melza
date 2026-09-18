"use client";

import { AttributionTrio, type AttributionMember } from "./attribution-trio";
import { Badge } from "./badge";
import { formatCurrency } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import { CategoryGlyph } from "@/lib/ui/category-icon";

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
  onLongPress,
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
  installments?: {
    current: number;
    total: number;
    /** Compra agrupada (mostra "10x" em vez de "1/10") */
    asPurchase?: boolean;
  } | null;
  consumer?: AttributionMember | null;
  payer?: AttributionMember | null;
  cardOwner?: AttributionMember | null;
  onClick?: () => void;
  onLongPress?: () => void;
  className?: string;
  embedded?: boolean;
}) {
  const showTrio = Boolean(consumer && payer && cardOwner);
  const allSame =
    showTrio &&
    consumer!.id === payer!.id &&
    payer!.id === cardOwner!.id;

  const meta = [paymentLabel, category, dateLabel].filter(Boolean).join(" · ");

  const sign =
    type === "income" ? "+" : type === "expense" ? "−" : "";
  const valueColor =
    type === "income"
      ? "text-[var(--color-income)]"
      : type === "expense"
        ? "text-[var(--color-expense)]"
        : "text-[var(--color-text-2)]";

  const content = (
    <>
      <CategoryGlyph
        name={category}
        emoji={emoji}
        className="h-9 w-9"
        size={15}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-[var(--color-text)]">
            {title}
          </span>
          {pending && (
            <Badge status="pending" className="shrink-0">
              Pendente
            </Badge>
          )}
          {installments && (
            <Badge status="installment" className="shrink-0">
              {installments.asPurchase
                ? `${installments.total}x`
                : `${installments.current}/${installments.total}`}
            </Badge>
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
    "flex w-full items-center gap-3 px-4 py-3 text-left transition-all duration-200",
    embedded
      ? "rounded-none border-0 bg-transparent hover:bg-[var(--color-chip)]"
      : "mb-1.5 rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] shadow-card hover:bg-[var(--color-chip)] hover:shadow-card-hover dark:shadow-card-dark dark:hover:shadow-card-hover-dark",
    onClick && "pressable-subtle cursor-pointer",
    className
  );

  if (onClick || onLongPress) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    return (
      <button
        type="button"
        onClick={onClick}
        onContextMenu={(e) => {
          if (!onLongPress) return;
          e.preventDefault();
          onLongPress();
        }}
        onTouchStart={() => {
          if (!onLongPress) return;
          timer = setTimeout(() => onLongPress(), 480);
        }}
        onTouchEnd={() => timer && clearTimeout(timer)}
        onTouchMove={() => timer && clearTimeout(timer)}
        className={base}
      >
        {content}
      </button>
    );
  }

  return <div className={base}>{content}</div>;
}
