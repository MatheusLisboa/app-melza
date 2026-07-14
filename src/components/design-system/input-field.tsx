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

/**
 * Campo Make — altura 50px, fundo surface, ícone à esquerda.
 */
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
      ...props
    },
    ref
  ) => {
    const inputId = id ?? (label ? label.replace(/\s+/g, "-").toLowerCase() : undefined);

    return (
      <div className={cn("flex flex-col gap-1.5", className)}>
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-medium tracking-wide text-foreground/50"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {icon && (
            <div className="pointer-events-none absolute left-3.5 text-foreground/30">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              "h-[50px] w-full rounded-xl border border-white/[0.08] bg-[#18181B] text-foreground/90 transition-colors placeholder:text-foreground/25 focus-visible:border-white/20 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
              inputClassName
            )}
            style={{
              paddingLeft: icon ? 44 : 16,
              paddingRight: rightEl ? 44 : 16,
            }}
            {...props}
          />
          {rightEl && (
            <div className="absolute right-3.5 text-foreground/40">{rightEl}</div>
          )}
        </div>
        {error ? (
          <span className="px-1 text-xs text-destructive">{error}</span>
        ) : hint ? (
          <span className="px-1 text-xs text-foreground/30">{hint}</span>
        ) : null}
      </div>
    );
  }
);
InputField.displayName = "InputField";
