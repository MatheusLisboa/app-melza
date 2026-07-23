"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type BtnVariant = "primary" | "secondary" | "ghost" | "destructive";
type BtnSize = "sm" | "md" | "lg";

const SIZES: Record<BtnSize, string> = {
  sm: "min-h-[36px] px-3 py-1.5 text-xs",
  md: "min-h-[44px] px-[18px] py-2 text-[13px]",
  lg: "min-h-[44px] px-5 py-2.5 text-sm",
};

const VARIANTS: Record<BtnVariant, string> = {
  primary:
    "bg-[var(--color-ink)] text-white hover:bg-[var(--color-onyx)] dark:bg-[var(--color-pearl)] dark:text-[var(--color-ink)] dark:hover:bg-[var(--color-fog)]",
  secondary:
    "bg-[var(--color-card)] text-[var(--color-text)] border border-[var(--color-line)] hover:bg-[var(--color-chip)]",
  ghost:
    "bg-transparent text-[var(--color-text-2)] hover:text-[var(--color-text)]",
  destructive:
    "bg-transparent border border-[#FEF2F2] text-[#EF4444] hover:bg-[#FEF2F2] dark:border-[#7F1D1D]/40 dark:hover:bg-[#7F1D1D]/20",
};

type BtnProps = {
  children: React.ReactNode;
  variant?: BtnVariant;
  size?: BtnSize;
  /** Aceito por compatibilidade; variantes usam tokens Melza. */
  wsColor?: string;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  className?: string;
} & Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "className"
>;

export const Btn = forwardRef<HTMLButtonElement, BtnProps>(function Btn(
  {
    children,
    variant = "primary",
    size = "md",
    fullWidth,
    icon,
    disabled,
    type = "button",
    className,
    wsColor: _wsColor,
    ...rest
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      className={cn(
        "inline-flex cursor-pointer select-none items-center justify-center gap-1.5 rounded-lg font-medium transition-colors duration-150",
        SIZES[size],
        VARIANTS[variant],
        fullWidth && "w-full",
        disabled && "pointer-events-none opacity-40",
        className
      )}
      {...rest}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  );
});
