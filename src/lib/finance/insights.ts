export type MonthSpendPoint = { key: string; total: number };

export function spendDelta(current: number, previous: number) {
  const delta = current - previous;
  const pct = previous > 0 ? (delta / previous) * 100 : current > 0 ? 100 : 0;
  return { current, previous, delta, pct };
}

/** Primeira categoria com maior variação absoluta vs o mês anterior. */
export function topCategoryInsight(
  current: { name: string; total: number }[],
  previous: { name: string; total: number }[]
): { name: string; delta: number; pct: number } | null {
  const prevMap = new Map(previous.map((r) => [r.name, r.total]));
  let best: { name: string; delta: number; pct: number } | null = null;
  for (const row of current) {
    const prev = prevMap.get(row.name) ?? 0;
    const delta = row.total - prev;
    if (Math.abs(delta) < 1) continue;
    const pct = prev > 0 ? (delta / prev) * 100 : 100;
    if (!best || Math.abs(delta) > Math.abs(best.delta)) {
      best = { name: row.name, delta, pct };
    }
  }
  return best;
}

export function sparklinePath(
  values: number[],
  width = 120,
  height = 36,
  pad = 2
): string {
  if (values.length === 0) return "";
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const step = values.length === 1 ? 0 : innerW / (values.length - 1);
  return values
    .map((v, i) => {
      const x = pad + i * step;
      const y = pad + innerH - ((v - min) / span) * innerH;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}
