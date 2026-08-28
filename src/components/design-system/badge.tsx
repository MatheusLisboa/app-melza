import { cn } from "@/lib/utils";

export type BadgeStatus =
  | "paid"
  | "pending"
  | "overdue"
  | "fixed"
  | "installment"
  | "custom";

const STATUS: Record<
  Exclude<BadgeStatus, "custom">,
  { bg: string; color: string; darkBg?: string; darkColor?: string }
> = {
  paid: { bg: "#F0FDF4", color: "#166534", darkBg: "#052e16", darkColor: "#86efac" },
  pending: { bg: "#FEF9EE", color: "#92400E", darkBg: "#3a2a10", darkColor: "#FBBF24" },
  overdue: { bg: "#FEF2F2", color: "#991B1B", darkBg: "#450a0a", darkColor: "#fca5a5" },
  fixed: { bg: "var(--color-chip)", color: "var(--color-text-2)" },
  installment: { bg: "var(--color-ink)", color: "#FFFFFF", darkBg: "var(--color-pearl)", darkColor: "var(--color-ink)" },
};

/** Badge Melza — pills do preview */
export function Badge({
  label,
  color,
  bg,
  status,
  className,
}: {
  label: string;
  color?: string;
  bg?: string;
  status?: BadgeStatus;
  className?: string;
}) {
  const preset =
    status && status !== "custom" ? STATUS[status] : null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
        className
      )}
      style={{
        color: preset?.color ?? color,
        backgroundColor: preset?.bg ?? bg,
      }}
    >
      {label}
    </span>
  );
}
