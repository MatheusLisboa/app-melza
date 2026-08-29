import { cn } from "@/lib/utils";

export type BadgeStatus =
  | "paid"
  | "pending"
  | "overdue"
  | "fixed"
  | "installment"
  | "outline"
  | "custom";

type Preset = {
  bg: string;
  color: string;
  border?: string;
  darkBg?: string;
  darkColor?: string;
  darkBorder?: string;
};

const STATUS: Record<Exclude<BadgeStatus, "custom">, Preset> = {
  paid: {
    bg: "#F0FDF4",
    color: "#166534",
    darkBg: "#052e16",
    darkColor: "#86efac",
  },
  pending: {
    bg: "#FEF9EE",
    color: "#92400E",
    darkBg: "#3a2a10",
    darkColor: "#FBBF24",
  },
  overdue: {
    bg: "#FEF2F2",
    color: "#991B1B",
    darkBg: "#450a0a",
    darkColor: "#fca5a5",
  },
  fixed: { bg: "var(--color-chip)", color: "var(--color-text-2)" },
  installment: {
    bg: "var(--color-ink)",
    color: "#FFFFFF",
    darkBg: "var(--color-pearl)",
    darkColor: "var(--color-ink)",
  },
  outline: {
    bg: "transparent",
    color: "var(--color-text-2)",
    border: "var(--color-line)",
  },
};

/**
 * Badge Melza — pills de status.
 *
 * Dark mode: os presets expõem `--badge-bg-dark` / `--badge-fg-dark` /
 * `--badge-bd-dark`, consumidos pelas utilities `dark:*-[var(...)]`. Quando o
 * preset não define variante dark, o fallback é o próprio valor light.
 */
export function Badge({
  label,
  children,
  color,
  bg,
  border,
  status,
  className,
}: {
  /** Texto do badge. Ignorado quando `children` é fornecido. */
  label?: string;
  children?: React.ReactNode;
  color?: string;
  bg?: string;
  /** Cor da borda. Sem valor, o badge não tem borda. */
  border?: string;
  status?: BadgeStatus;
  className?: string;
}) {
  const preset = status && status !== "custom" ? STATUS[status] : null;

  const bgLight = preset?.bg ?? bg;
  const fgLight = preset?.color ?? color;
  const bdLight = preset?.border ?? border;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
        "dark:bg-[var(--badge-bg-dark)] dark:text-[var(--badge-fg-dark)]",
        bdLight && "border dark:border-[var(--badge-bd-dark)]",
        className
      )}
      style={
        {
          color: fgLight,
          backgroundColor: bgLight,
          borderColor: bdLight,
          "--badge-bg-dark": preset?.darkBg ?? bgLight,
          "--badge-fg-dark": preset?.darkColor ?? fgLight,
          "--badge-bd-dark": preset?.darkBorder ?? bdLight,
        } as React.CSSProperties
      }
    >
      {children ?? label}
    </span>
  );
}
