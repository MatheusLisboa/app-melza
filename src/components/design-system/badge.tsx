import { cn } from "@/lib/utils";

/** Make: Badge — pill uppercase colorido */
export function Badge({
  label,
  color,
  bg,
  className,
}: {
  label: string;
  color: string;
  bg: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        className
      )}
      style={{ color, backgroundColor: bg }}
    >
      {label}
    </span>
  );
}
