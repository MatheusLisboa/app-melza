import { formatCurrency } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

type MoneySize = "sm" | "md" | "xl" | "2xl";

const SIZE: Record<MoneySize, string> = {
  sm: "text-sm",
  md: "text-lg",
  xl: "text-[28px]",
  "2xl": "text-[32px]",
};

/**
 * Valor monetário Melza — mono contínuo (como no preview: R$ 10.460,97)
 */
export function MoneyDisplay({
  amount,
  size = "xl",
  className,
  color,
  signed = true,
}: {
  amount: number;
  size?: MoneySize;
  className?: string;
  color?: string;
  signed?: boolean;
}) {
  const negative = signed && amount < 0;
  const text = formatCurrency(Math.abs(amount));

  return (
    <span
      className={cn(
        "font-mono font-extrabold tracking-tight leading-none text-[#111111]",
        SIZE[size],
        !color && negative && "text-[#EF4444]",
        className
      )}
      style={color ? { color } : undefined}
    >
      {negative ? `−${text}` : text}
    </span>
  );
}
