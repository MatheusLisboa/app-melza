"use client";

import { Delete } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  centsDigitsToNumber,
  formatBRL,
  toCents,
} from "@/lib/utils/format";
import { haptic } from "@/lib/ui/haptic";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"] as const;

export function MoneyKeypad({
  value,
  onValueChange,
  maxDigits = 10,
  className,
}: {
  value: number;
  onValueChange: (value: number) => void;
  maxDigits?: number;
  className?: string;
}) {
  const cents = toCents(value);
  const digits = cents === 0 ? "" : String(cents);

  function push(d: string) {
    haptic("light");
    const next = (digits + d).replace(/^0+/, "").slice(0, maxDigits);
    onValueChange(next ? centsDigitsToNumber(next) : 0);
  }

  function back() {
    haptic("light");
    const next = digits.slice(0, -1);
    onValueChange(next ? centsDigitsToNumber(next) : 0);
  }

  return (
    <div className={cn("space-y-3", className)}>
      <p className="text-center font-mono text-[36px] font-extrabold leading-none tracking-tight text-[var(--color-text)]">
        <span className="mr-1 text-[18px] font-semibold text-[var(--color-text-2)]">
          R$
        </span>
        {formatBRL(value)}
      </p>
      <div className="grid grid-cols-3 gap-1.5">
        {KEYS.map((k, i) => {
          if (k === "") return <span key={`empty-${i}`} />;
          if (k === "back") {
            return (
              <button
                key="back"
                type="button"
                onClick={back}
                className="flex h-14 items-center justify-center rounded-2xl text-[var(--color-text-2)] transition-colors hover:bg-[var(--color-chip)] active:scale-[0.97]"
                aria-label="Apagar"
              >
                <Delete size={22} strokeWidth={1.75} />
              </button>
            );
          }
          return (
            <button
              key={k}
              type="button"
              onClick={() => push(k)}
              className="h-14 rounded-2xl text-[22px] font-semibold tabular-nums text-[var(--color-text)] transition-colors hover:bg-[var(--color-chip)] active:scale-[0.97]"
            >
              {k}
            </button>
          );
        })}
      </div>
    </div>
  );
}
