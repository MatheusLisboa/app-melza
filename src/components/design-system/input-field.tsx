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
          <label
            htmlFor={inputId}
            className="text-xs font-medium uppercase tracking-wide text-[#8E8E93]"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {icon && (
            <div className="pointer-events-none absolute left-3 text-[#C7C7CC]">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            type={type}
            className={cn(
              "h-[44px] w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-input)] text-[var(--color-text)] transition-colors duration-150 placeholder:text-[var(--color-mist)] focus-visible:border-[var(--color-night)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-night)]/10 disabled:cursor-not-allowed disabled:opacity-50",
              isMoney && "font-mono font-bold",
              inputClassName
            )}
            style={{
              paddingLeft: icon ? 40 : 14,
              paddingRight: rightEl ? 40 : 14,
              paddingTop: 10,
              paddingBottom: 10,
            }}
            {...props}
          />
          {rightEl && (
            <div className="absolute right-3 text-[#8E8E93]">{rightEl}</div>
          )}
        </div>
        {error ? (
          <span className="px-1 text-xs text-[#EF4444]">{error}</span>
        ) : hint ? (
          <span className="px-1 text-xs text-[#8E8E93]">{hint}</span>
        ) : null}
      </div>
    );
  }
);
InputField.displayName = "InputField";
