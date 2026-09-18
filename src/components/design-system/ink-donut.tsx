import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/format";

export type DonutSlice = { name: string; value: number };

export function InkDonut({
  slices,
  className,
}: {
  slices: DonutSlice[];
  className?: string;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total <= 0) return null;
  const size = 132;
  const r = 46;
  const c = 2 * Math.PI * r;
  const cx = size / 2;
  const cy = size / 2;
  let offset = 0;
  const opacities = [1, 0.72, 0.5, 0.34, 0.22, 0.14];

  return (
    <div className={cn("flex items-center gap-4", className)}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="var(--color-chip)"
          strokeWidth="14"
        />
        {slices.slice(0, 6).map((slice, i) => {
          const len = (slice.value / total) * c;
          const el = (
            <circle
              key={slice.name}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke="var(--color-ink)"
              strokeWidth="14"
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
              transform={`rotate(-90 ${cx} ${cy})`}
              opacity={opacities[i] ?? 0.12}
              className="dark:stroke-[var(--color-pearl)]"
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <ul className="min-w-0 flex-1 space-y-1.5">
        {slices.slice(0, 5).map((s, i) => (
          <li key={s.name} className="flex items-center gap-2 text-[12px]">
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-ink)] dark:bg-[var(--color-pearl)]"
              style={{ opacity: opacities[i] ?? 0.12 }}
            />
            <span className="min-w-0 flex-1 truncate text-[var(--color-text)]">
              {s.name}
            </span>
            <span className="font-mono text-[11px] text-[var(--color-text-2)]">
              {formatCurrency(s.value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
