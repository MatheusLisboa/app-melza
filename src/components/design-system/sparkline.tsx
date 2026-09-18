import { sparklinePath } from "@/lib/finance/insights";
import { cn } from "@/lib/utils";

export function Sparkline({
  values,
  className,
  width = 140,
  height = 36,
}: {
  values: number[];
  className?: string;
  width?: number;
  height?: number;
}) {
  const d = sparklinePath(values, width, height);
  if (!d) return null;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("overflow-visible", className)}
      aria-hidden
    >
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
