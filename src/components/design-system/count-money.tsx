"use client";

import { useEffect, useRef, useState } from "react";
import { formatCurrency } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

export function CountMoney({
  value,
  className,
  hidden = false,
}: {
  value: number;
  className?: string;
  hidden?: boolean;
}) {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    if (hidden) {
      fromRef.current = value;
      setShown(value);
      return;
    }
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || fromRef.current === value) {
      fromRef.current = value;
      setShown(value);
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    const dur = 280;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - (1 - t) ** 3;
      setShown(from + (value - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, hidden]);

  if (hidden) return <span className={className}>••••••</span>;
  return (
    <span className={cn("tabular-nums", className)}>
      {formatCurrency(shown)}
    </span>
  );
}
