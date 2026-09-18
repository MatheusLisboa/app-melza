"use client";

import Link from "next/link";
import { formatCurrency } from "@/lib/utils/format";
import { getBankColor, getBankName } from "@/lib/utils/banks";
import { cn } from "@/lib/utils";

function readableOn(hex: string): "white" | "ink" {
  const h = hex.replace("#", "");
  if (h.length < 6) return "white";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const y = (r * 299 + g * 587 + b * 114) / 1000;
  return y > 160 ? "ink" : "white";
}

export function PhysicalCard({
  href,
  name,
  bank,
  lastFour,
  available,
  cycleLabel,
  usedPct,
  className,
}: {
  href: string;
  name: string;
  bank: string;
  lastFour?: string | null;
  available?: number | null;
  cycleLabel?: string | null;
  usedPct?: number | null;
  className?: string;
}) {
  const bg = getBankColor(bank) || "#111111";
  const fg = readableOn(bg);
  const text = fg === "white" ? "#ffffff" : "#111111";
  const muted = fg === "white" ? "rgba(255,255,255,0.7)" : "rgba(17,17,17,0.55)";

  return (
    <Link
      href={href}
      className={cn(
        "relative block aspect-[1.62/1] w-[260px] shrink-0 snap-center overflow-hidden rounded-[18px] p-4 transition-transform active:scale-[0.98]",
        className
      )}
      style={{ background: bg }}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full"
        style={{ background: fg === "white" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}
      />
      <p className="text-[10px] font-medium uppercase tracking-[0.12em]" style={{ color: muted }}>
        {getBankName(bank)}
      </p>
      <p className="mt-1 truncate text-[16px] font-semibold" style={{ color: text }}>
        {name}
      </p>
      <p className="mt-3 font-mono text-[15px] tracking-[0.18em]" style={{ color: text }}>
        •• {lastFour || "••••"}
      </p>
      <div className="absolute inset-x-4 bottom-3.5">
        <div className="mb-1.5 flex items-end justify-between gap-2">
          <div>
            <p className="text-[9px] uppercase tracking-wide" style={{ color: muted }}>
              Disponível
            </p>
            <p className="font-mono text-[13px] font-bold" style={{ color: text }}>
              {available != null ? formatCurrency(available) : "—"}
            </p>
          </div>
          {cycleLabel ? (
            <p className="max-w-[46%] truncate text-right text-[10px]" style={{ color: muted }}>
              {cycleLabel}
            </p>
          ) : null}
        </div>
        {usedPct != null ? (
          <div
            className="h-1 overflow-hidden rounded-full"
            style={{ background: fg === "white" ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.12)" }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, usedPct)}%`,
                background: text,
              }}
            />
          </div>
        ) : null}
      </div>
    </Link>
  );
}
