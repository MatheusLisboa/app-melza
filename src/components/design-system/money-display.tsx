import { cn } from "@/lib/utils";

type MoneySize = "sm" | "md" | "xl" | "2xl";

const SIZE: Record<MoneySize, string> = {
  sm: "text-lg",
  md: "text-2xl",
  xl: "text-[34px]",
  "2xl": "text-[42px]",
};

/** Valor monetário no estilo Figma — JetBrains Mono, R$ + decimais suaves */
export function MoneyDisplay({
  amount,
  size = "xl",
  className,
  color,
}: {
  amount: number;
  size?: MoneySize;
  className?: string;
  color?: string;
}) {
  const [int, dec] = Math.abs(amount).toFixed(2).split(".");
  const formatted = parseInt(int, 10).toLocaleString("pt-BR");

  return (
    <span
      className={cn(
        "font-money font-semibold tracking-tight leading-none",
        SIZE[size],
        className
      )}
      style={color ? { color } : undefined}
    >
      <span className="mr-0.5 text-[0.55em] opacity-60">R$</span>
      {formatted}
      <span className="text-[0.65em] opacity-60">,{dec}</span>
    </span>
  );
}
