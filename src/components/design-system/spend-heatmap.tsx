import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/format";

export type HeatDay = { date: string; total: number };

export function SpendHeatmap({
  days,
  className,
}: {
  days: HeatDay[];
  className?: string;
}) {
  const max = Math.max(...days.map((d) => d.total), 1);
  return (
    <div className={cn("overflow-hidden rounded-[14px] border border-[var(--color-line)] bg-[var(--color-card)] p-4", className)}>
      <p className="mb-3 text-[13px] font-semibold">Gasto por dia</p>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const t = new Date(`${d.date}T12:00:00`);
          const intensity = d.total <= 0 ? 0 : Math.max(0.12, d.total / max);
          return (
            <div
              key={d.date}
              title={`${d.date} · ${formatCurrency(d.total)}`}
              className="aspect-square rounded-[5px] bg-[var(--color-chip)]"
              style={
                d.total > 0
                  ? {
                      background: "var(--color-ink)",
                      opacity: intensity,
                    }
                  : undefined
              }
            >
              <span className="sr-only">
                {t.getDate()} {formatCurrency(d.total)}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-[var(--color-text-3)]">
        Últimos {days.length} dias · toque longo no quadrado no desktop mostra o valor
      </p>
    </div>
  );
}
