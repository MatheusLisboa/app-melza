"use client";

import { cn } from "@/lib/utils";

type BtnVariant = "primary" | "secondary" | "ghost" | "destructive";
type BtnSize = "sm" | "md" | "lg";

const SIZES: Record<BtnSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-[18px] py-2 text-[13px]",
  lg: "px-5 py-2.5 text-sm",
};

const VARIANTS: Record<BtnVariant, string> = {
  primary:
    "bg-[var(--color-ink)] text-white hover:bg-[#2C2C2E] dark:bg-[#F2F2F7] dark:text-[#111] dark:hover:bg-[#E5E5EA]",
  secondary:
    "bg-[var(--color-card)] text-[var(--color-text)] border border-[var(--color-line)] hover:bg-[var(--color-chip)]",
  ghost:
    "bg-transparent text-[var(--color-text-2)] hover:text-[var(--color-text)]",
  destructive:
    "bg-transparent border border-[#FEF2F2] text-[#EF4444] hover:bg-[#FEF2F2] dark:border-[#7F1D1D]/40 dark:hover:bg-[#7F1D1D]/20",
};

export function Btn({
  children,
  variant = "primary",
  size = "md",
  onClick,
  fullWidth,
  icon,
  disabled,
  type = "button",
  className,
}: {
  children: React.ReactNode;
  variant?: BtnVariant;
  size?: BtnSize;
  /** Aceito por compatibilidade; variantes usam tokens Melza. */
  wsColor?: string;
  onClick?: () => void;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  className?: string;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex cursor-pointer select-none items-center justify-center gap-1.5 rounded-lg font-medium transition-colors duration-150",
        SIZES[size],
        VARIANTS[variant],
        fullWidth && "w-full",
        disabled && "pointer-events-none opacity-40",
        className
      )}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  );
}
