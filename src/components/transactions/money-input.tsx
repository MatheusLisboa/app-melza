"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  centsDigitsToNumber,
  digitsOnly,
  formatBRL,
  formatCents,
  toCents,
} from "@/lib/utils/format";

interface MoneyInputProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "onChange" | "value" | "type"
  > {
  value: number;
  onValueChange: (value: number) => void;
  /** Máx. dígitos de centavos (12 = até 9.999.999.999,99) */
  maxDigits?: number;
}

/**
 * Máscara BRL digitando centavos: 1 → 0,01 · 150 → 1,50 · 123456 → 1.234,56
 * Não reforma no meio da digitação (só sincroniza quando desfocado / value externo).
 */
export function MoneyInput({
  value,
  onValueChange,
  className,
  maxDigits = 12,
  onFocus,
  onBlur,
  ...props
}: MoneyInputProps) {
  const focusedRef = React.useRef(false);
  const [display, setDisplay] = React.useState(() =>
    value > 0 ? formatBRL(value) : ""
  );

  React.useEffect(() => {
    if (focusedRef.current) return;
    setDisplay(value > 0 ? formatBRL(value) : "");
  }, [value]);

  function commitDigits(raw: string) {
    const digits = digitsOnly(raw).slice(0, maxDigits);
    if (!digits) {
      setDisplay("");
      onValueChange(0);
      return;
    }
    const cents = parseInt(digits, 10);
    setDisplay(formatCents(cents));
    onValueChange(centsDigitsToNumber(digits));
  }

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
        R$
      </span>
      <Input
        {...props}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className={cn("pl-10 font-money tabular-nums", className)}
        value={display}
        onFocus={(e) => {
          focusedRef.current = true;
          onFocus?.(e);
        }}
        onChange={(e) => commitDigits(e.target.value)}
        onBlur={(e) => {
          focusedRef.current = false;
          if (value > 0) {
            setDisplay(formatBRL(value));
          } else {
            setDisplay("");
          }
          onBlur?.(e);
        }}
        onKeyDown={(e) => {
          // Atalho: se selecionar tudo e digitar, já vem no onChange
          if (e.key === "Backspace" && display && !window.getSelection()?.toString()) {
            // ok default
          }
        }}
      />
    </div>
  );
}

/** Uso interno / teste — formata a partir do valor atual em centavos */
export function moneyDisplayFromValue(value: number): string {
  return value > 0 ? formatCents(toCents(value)) : "";
}
