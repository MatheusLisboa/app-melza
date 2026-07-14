"use client";

import { cn } from "@/lib/utils";

type BtnVariant = "primary" | "secondary" | "ghost" | "destructive";
type BtnSize = "sm" | "md" | "lg";

const SIZES: Record<BtnSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-11 px-4 text-sm",
  lg: "h-[52px] px-5 text-[15px]",
};

const VARIANTS: Record<BtnVariant, string> = {
  primary: "text-white",
  secondary: "bg-white/[0.07] text-white/80 hover:bg-white/[0.11]",
  ghost: "text-white/50 hover:bg-white/[0.06] hover:text-white/80",
  destructive: "bg-[#EF444422] text-[#EF4444] hover:bg-[#EF444433]",
};

/** Make: Btn — primary tintável via wsColor */
export function Btn({
  children,
  variant = "primary",
  size = "md",
  wsColor,
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
  wsColor?: string;
  onClick?: () => void;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  className?: string;
}) {
  const bg =
    variant === "primary" ? wsColor || "#6366F1" : undefined;

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex cursor-pointer select-none items-center justify-center gap-2 rounded-xl font-medium transition-all active:scale-[0.97]",
        SIZES[size],
        VARIANTS[variant],
        fullWidth && "w-full",
        disabled && "pointer-events-none opacity-40",
        className
      )}
      style={bg ? { backgroundColor: bg } : undefined}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  );
}
