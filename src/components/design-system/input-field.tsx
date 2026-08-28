"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type InputFieldProps = Omit<
  React.ComponentProps<"input">,
  "className"
> & {
  label?: string;
  hint?: string;
  error?: string;
  icon?: React.ReactNode;
  rightEl?: React.ReactNode;
  className?: string;
  inputClassName?: string;
};

/** Input Melza v2 — branco, borda fog, focus night */
export const InputField = React.forwardRef<HTMLInputElement, InputFieldProps>(
  (
    {
      label,
      hint,
      error,
      icon,
      rightEl,
      className,
      inputClassName,
      id,
      type,
      ...props
    },
    ref
  ) => {
    const inputId =
      id ?? (label ? label.replace(/\s+/g, "-").toLowerCase() : undefined);
    const isMoney =
      type === "number" ||
      inputClassName?.includes("font-mono") ||
      props.name?.includes("amount") ||
      props.name?.includes("value");

    return (
      <div className={cn("flex flex-col gap-1.5", className)}>
        {label && (
          <label htmlFor={inputId} className="text-label text-[var(--color-text-2)]">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {icon && (
            <div className="pointer-events-none absolute left-3.5 text-[var(--color-text-3)]">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            type={type}
            className={cn(
              "h-[48px] w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-input)] px-3.5 py-2.5 text-[var(--color-text)] shadow-card transition-all duration-200 placeholder:text-[var(--color-text-3)] focus-visible:border-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-text)]/10 disabled:cursor-not-allowed disabled:opacity-50 dark:shadow-none",
              icon && "pl-11",
              rightEl && "pr-11",
              isMoney && "font-mono font-bold",
              inputClassName
            )}
            {...props}
          />
          {rightEl && (
            <div className="absolute right-3.5 text-[var(--color-text-2)]">
              {rightEl}
            </div>
          )}
        </div>
        {error ? (
          <span className="px-1 text-xs text-expense">{error}</span>
        ) : hint ? (
          <span className="px-1 text-xs text-[var(--color-text-2)]">{hint}</span>
        ) : null}
      </div>
    );
  }
);
InputField.displayName = "InputField";
