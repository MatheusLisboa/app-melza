"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { digitsOnly, parseDayOfMonth } from "@/lib/utils/format";

type BaseOmit = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "value" | "type"
>;

/** Só dígitos, length fixo (ex: final do cartão) */
export function DigitMaskInput({
  value,
  onValueChange,
  maxLength = 4,
  className,
  ...props
}: BaseOmit & {
  value: string;
  onValueChange: (value: string) => void;
  maxLength?: number;
}) {
  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      maxLength={maxLength}
      className={cn("font-mono tabular-nums", className)}
      value={value}
      onChange={(e) => {
        onValueChange(digitsOnly(e.target.value).slice(0, maxLength));
      }}
    />
  );
}

/** Dia do mês 1–31 */
export function DayOfMonthInput({
  value,
  onValueChange,
  className,
  ...props
}: BaseOmit & {
  value: number | null | undefined;
  onValueChange: (value: number | null) => void;
}) {
  const [text, setText] = React.useState(() =>
    value && value > 0 ? String(value) : ""
  );
  const focused = React.useRef(false);

  React.useEffect(() => {
    if (focused.current) return;
    setText(value && value > 0 ? String(value) : "");
  }, [value]);

  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      maxLength={2}
      className={cn("tabular-nums", className)}
      value={text}
      onFocus={() => {
        focused.current = true;
      }}
      onChange={(e) => {
        const d = digitsOnly(e.target.value).slice(0, 2);
        setText(d);
        onValueChange(parseDayOfMonth(d));
      }}
      onBlur={() => {
        focused.current = false;
        const parsed = parseDayOfMonth(text);
        if (parsed == null) {
          setText("");
          onValueChange(null);
        } else {
          setText(String(parsed));
          onValueChange(parsed);
        }
      }}
    />
  );
}

/** Inteiro com min/max (parcelas, etc.) */
export function IntegerMaskInput({
  value,
  onValueChange,
  min = 0,
  max = 99,
  className,
  ...props
}: BaseOmit & {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
}) {
  const maxLen = String(max).length;
  const [text, setText] = React.useState(() =>
    value > 0 ? String(value) : ""
  );
  const focused = React.useRef(false);

  React.useEffect(() => {
    if (focused.current) return;
    setText(value > 0 ? String(value) : "");
  }, [value]);

  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      maxLength={maxLen}
      className={cn("tabular-nums", className)}
      value={text}
      onFocus={() => {
        focused.current = true;
      }}
      onChange={(e) => {
        const d = digitsOnly(e.target.value).slice(0, maxLen);
        setText(d);
        if (!d) {
          onValueChange(min);
          return;
        }
        let n = parseInt(d, 10);
        if (n > max) n = max;
        onValueChange(n);
      }}
      onBlur={() => {
        focused.current = false;
        let n = parseInt(digitsOnly(text) || "0", 10);
        if (!Number.isFinite(n) || n < min) n = min;
        if (n > max) n = max;
        setText(String(n));
        onValueChange(n);
      }}
    />
  );
}
