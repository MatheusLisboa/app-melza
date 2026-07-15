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
  { bg: string; color: string }
> = {
  paid: { bg: "#F0FDF4", color: "#166534" },
  pending: { bg: "#FEF9EE", color: "#92400E" },
  overdue: { bg: "#FEF2F2", color: "#991B1B" },
  fixed: { bg: "#F2F2F7", color: "#3A3A3C" },
  installment: { bg: "#111111", color: "#FFFFFF" },
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
