"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

const MARK = {
  sm: { px: 36, className: "h-9 w-9 rounded-[10px]" },
  md: { px: 56, className: "h-14 w-14 rounded-2xl" },
  lg: { px: 80, className: "h-20 w-20 rounded-[22px]" },
} as const;

/**
 * Monograma Melza (M geométrico em fundo ink).
 */
export function BrandMark({
  size = "md",
  className,
  inverted: _inverted = false,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Mantido por compatibilidade — a marca oficial já é ink + prata. */
  inverted?: boolean;
}) {
  const s = MARK[size];
  return (
    <Image
      src="/brand/melza-icon.png"
      alt="Melza"
      width={s.px}
      height={s.px}
      className={cn(
        "shrink-0 object-cover shadow-[0_0_0_1px_rgba(0,0,0,0.06)]",
        s.className,
        className
      )}
      priority
    />
  );
}

/**
 * Mark + wordmark MELZA (tracking largo, alinhado à identidade).
 */
export function BrandWordmark({
  size = "md",
  className,
  markClassName,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
  markClassName?: string;
}) {
  const text = {
    sm: "text-[13px] tracking-[0.28em]",
    md: "text-[17px] tracking-[0.32em]",
    lg: "text-[22px] tracking-[0.36em]",
  };

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <BrandMark
        size={size === "lg" ? "md" : size}
        className={markClassName}
      />
      <span
        className={cn(
          "select-none font-medium uppercase text-[var(--color-ink)]",
          text[size]
        )}
      >
        MELZA
      </span>
    </div>
  );
}

/**
 * Lockup oficial (M + MELZA) — ideal para login / onboarding.
 */
export function BrandLockup({
  className,
  priority = true,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative mx-auto w-full max-w-[280px] overflow-hidden rounded-[28px] shadow-[0_8px_30px_rgba(0,0,0,0.12)] ring-1 ring-black/[0.06]",
        className
      )}
    >
      <Image
        src="/brand/melza-lockup.png"
        alt="Melza"
        width={880}
        height={640}
        className="h-auto w-full object-cover"
        priority={priority}
      />
    </div>
  );
}
