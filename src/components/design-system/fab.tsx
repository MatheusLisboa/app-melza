"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/** FAB — primário Melza ink */
export function Fab({
  href,
  onClick,
  className,
}: {
  href?: string;
  onClick?: () => void;
  /** @deprecated Ignorado — usa ink Melza */
  color?: string;
  className?: string;
}) {
  const classNames = cn(
    "fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-ink)] text-[var(--color-white)] transition-transform duration-150 ease-linear active:scale-95 hover:bg-[var(--color-onyx)] dark:bg-[var(--color-pearl)] dark:text-[var(--color-ink)] lg:bottom-8 lg:right-5",
    className
  );

  if (onClick || !href) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label="Nova transação"
        className={classNames}
      >
        <Plus className="h-6 w-6" strokeWidth={2} />
      </button>
    );
  }

  return (
    <Link href={href} aria-label="Nova transação" className={classNames}>
      <Plus className="h-6 w-6" strokeWidth={2} />
    </Link>
  );
}
