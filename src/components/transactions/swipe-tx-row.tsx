"use client";

import { useRef, useState, type ReactNode } from "react";
import { Tag, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/ui/haptic";

export function SwipeTxRow({
  children,
  onDelete,
  onCategorize,
  disabled,
}: {
  children: ReactNode;
  onDelete?: () => void;
  onCategorize?: () => void;
  disabled?: boolean;
}) {
  const startX = useRef(0);
  const xRef = useRef(0);
  const [x, setX] = useState(0);
  const dragging = useRef(false);

  if (disabled || (!onDelete && !onCategorize)) {
    return <>{children}</>;
  }

  function reset() {
    xRef.current = 0;
    setX(0);
  }

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-y-0 left-0 flex w-[76px] items-center justify-center bg-[var(--color-chip)]">
        <button
          type="button"
          className="flex h-full w-full flex-col items-center justify-center gap-1 text-[11px] font-medium text-[var(--color-text)]"
          onClick={() => {
            haptic("light");
            onCategorize?.();
            reset();
          }}
        >
          <Tag size={16} strokeWidth={1.75} />
          Categoria
        </button>
      </div>
      <div className="absolute inset-y-0 right-0 flex w-[76px] items-center justify-center bg-[var(--color-expense)]/10">
        <button
          type="button"
          className="flex h-full w-full flex-col items-center justify-center gap-1 text-[11px] font-medium text-[var(--color-expense)]"
          onClick={() => {
            haptic("warn");
            onDelete?.();
            reset();
          }}
        >
          <Trash2 size={16} strokeWidth={1.75} />
          Apagar
        </button>
      </div>
      <div
        className={cn(
          "relative bg-[var(--color-card)]",
          dragging.current ? "" : "transition-transform duration-200"
        )}
        style={{ transform: `translateX(${x}px)` }}
        onTouchStart={(e) => {
          dragging.current = true;
          startX.current = e.touches[0].clientX - xRef.current;
        }}
        onTouchMove={(e) => {
          if (!dragging.current) return;
          const next = e.touches[0].clientX - startX.current;
          const clamped = Math.max(-80, Math.min(80, next));
          xRef.current = clamped;
          setX(clamped);
        }}
        onTouchEnd={() => {
          dragging.current = false;
          const cur = xRef.current;
          const next = cur > 48 ? 76 : cur < -48 ? -76 : 0;
          xRef.current = next;
          setX(next);
        }}
      >
        {children}
      </div>
    </div>
  );
}
