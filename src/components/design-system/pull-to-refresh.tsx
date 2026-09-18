"use client";

import { useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PullToRefresh({
  onRefresh,
  children,
  className,
}: {
  onRefresh: () => Promise<void> | void;
  children: ReactNode;
  className?: string;
}) {
  const startY = useRef(0);
  const pulling = useRef(false);
  const [dy, setDy] = useState(0);
  const [busy, setBusy] = useState(false);

  function onTouchStart(e: React.TouchEvent) {
    if (busy) return;
    let p: HTMLElement | null = e.currentTarget.parentElement;
    while (p && p.scrollHeight <= p.clientHeight + 4) p = p.parentElement;
    if (p && p.scrollTop > 4) return;
    startY.current = e.touches[0].clientY;
    pulling.current = true;
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!pulling.current) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0) setDy(Math.min(72, delta * 0.45));
  }

  async function onTouchEnd() {
    if (!pulling.current) return;
    pulling.current = false;
    if (dy > 48 && !busy) {
      setBusy(true);
      setDy(36);
      try {
        await onRefresh();
      } finally {
        setBusy(false);
        setDy(0);
      }
    } else {
      setDy(0);
    }
  }

  return (
    <div
      className={cn("relative", className)}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div
        className="pointer-events-none flex h-0 items-end justify-center overflow-visible text-[11px] text-[var(--color-text-3)]"
        style={{ transform: `translateY(${dy}px)` }}
      >
        {dy > 8 || busy ? (busy ? "Atualizando…" : "Solte para atualizar") : null}
      </div>
      <div style={{ transform: dy ? `translateY(${dy}px)` : undefined }}>
        {children}
      </div>
    </div>
  );
}
