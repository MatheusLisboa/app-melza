"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/** FAB flutuante — nova transação (Figma: bottom-right sobre a bottom nav) */
export function Fab({
  href,
  onClick,
  color = "hsl(var(--primary))",
  className,
}: {
  href?: string;
  onClick?: () => void;
  color?: string;
  className?: string;
}) {
  const classNames = cn(
        "fixed bottom-[calc(90px+env(safe-area-inset-bottom,0px))] right-5 z-30 flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-fab transition-transform active:scale-95 lg:bottom-8",
    className
  );
  const style = {
    backgroundColor: color,
    boxShadow: `0 8px 32px ${color}55`,
  };

  if (onClick || !href) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label="Nova transação"
        className={classNames}
        style={style}
      >
        <Plus className="h-6 w-6" strokeWidth={2.5} />
      </button>
    );
  }

  return (
    <Link
      href={href}
      aria-label="Nova transação"
      className={classNames}
      style={style}
    >
      <Plus className="h-6 w-6" strokeWidth={2.5} />
    </Link>
  );
}
