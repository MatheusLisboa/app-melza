"use client";

import { Btn } from "./btn";
import { cn } from "@/lib/utils";

type Scene = "tx" | "card" | "invoice" | "report" | "goal" | "search";

function SceneArt({ scene }: { scene: Scene }) {
  if (scene === "card") {
    return (
      <svg width="88" height="58" viewBox="0 0 88 58" aria-hidden>
        <rect x="8" y="10" width="72" height="44" rx="10" fill="var(--color-ink)" className="dark:fill-[var(--color-pearl)]" />
        <rect x="16" y="20" width="22" height="8" rx="2" fill="var(--color-card)" opacity="0.35" />
        <rect x="16" y="38" width="36" height="4" rx="2" fill="var(--color-card)" opacity="0.45" />
      </svg>
    );
  }
  if (scene === "invoice") {
    return (
      <svg width="64" height="72" viewBox="0 0 64 72" aria-hidden>
        <rect x="10" y="6" width="44" height="60" rx="8" fill="var(--color-card)" stroke="var(--color-line)" />
        <path d="M22 22h20M22 32h16M22 42h12" stroke="var(--color-ink)" strokeWidth="2" className="dark:stroke-[var(--color-pearl)]" />
      </svg>
    );
  }
  if (scene === "report") {
    return (
      <svg width="88" height="48" viewBox="0 0 88 48" aria-hidden>
        <rect x="8" y="26" width="10" height="16" rx="2" fill="var(--color-ink)" opacity="0.25" className="dark:fill-[var(--color-pearl)]" />
        <rect x="26" y="14" width="10" height="28" rx="2" fill="var(--color-ink)" opacity="0.5" className="dark:fill-[var(--color-pearl)]" />
        <rect x="44" y="20" width="10" height="22" rx="2" fill="var(--color-ink)" opacity="0.35" className="dark:fill-[var(--color-pearl)]" />
        <rect x="62" y="8" width="10" height="34" rx="2" fill="var(--color-ink)" className="dark:fill-[var(--color-pearl)]" />
      </svg>
    );
  }
  if (scene === "goal") {
    return (
      <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden>
        <circle cx="36" cy="36" r="28" fill="none" stroke="var(--color-chip)" strokeWidth="8" />
        <circle
          cx="36"
          cy="36"
          r="28"
          fill="none"
          stroke="var(--color-ink)"
          strokeWidth="8"
          strokeDasharray="50 176"
          className="dark:stroke-[var(--color-pearl)]"
        />
      </svg>
    );
  }
  if (scene === "search") {
    return (
      <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden>
        <circle cx="28" cy="28" r="14" fill="none" stroke="var(--color-ink)" strokeWidth="3" className="dark:stroke-[var(--color-pearl)]" />
        <path d="M38 38l12 12" stroke="var(--color-ink)" strokeWidth="3" strokeLinecap="round" className="dark:stroke-[var(--color-pearl)]" />
      </svg>
    );
  }
  return (
    <svg width="88" height="56" viewBox="0 0 88 56" aria-hidden>
      <rect x="6" y="8" width="76" height="14" rx="7" fill="var(--color-chip)" />
      <rect x="6" y="28" width="76" height="14" rx="7" fill="var(--color-chip)" />
      <circle cx="18" cy="15" r="4" fill="var(--color-ink)" className="dark:fill-[var(--color-pearl)]" />
      <circle cx="18" cy="35" r="4" fill="var(--color-ink)" opacity="0.4" className="dark:fill-[var(--color-pearl)]" />
    </svg>
  );
}

export function EmptyState({
  icon,
  title,
  desc,
  description,
  cta,
  actionLabel,
  onCta,
  onAction,
  wsColor,
  className,
  scene,
}: {
  icon?: React.ReactNode;
  title: string;
  desc?: string;
  description?: string;
  cta?: string;
  actionLabel?: string;
  onCta?: () => void;
  onAction?: () => void;
  wsColor?: string;
  className?: string;
  scene?: Scene;
}) {
  const body = desc ?? description;
  const ctaLabel = cta ?? actionLabel;
  const handleCta = onCta ?? onAction;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 px-6 py-12 text-center",
        className
      )}
    >
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[var(--color-chip)]">
        {icon ?? <SceneArt scene={scene ?? "tx"} />}
      </div>
      <div>
        <p className="text-subtitle">{title}</p>
        {body && (
          <p className="mt-1.5 text-body text-[var(--color-text-2)]">{body}</p>
        )}
      </div>
      {ctaLabel && handleCta && (
        <Btn
          variant="secondary"
          size="sm"
          wsColor={wsColor}
          onClick={handleCta}
        >
          {ctaLabel}
        </Btn>
      )}
    </div>
  );
}
