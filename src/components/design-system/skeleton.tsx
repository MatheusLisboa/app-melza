import { cn } from "@/lib/utils";

export function DsSkeleton({
  className,
  h = "h-4",
  w = "w-full",
}: {
  className?: string;
  h?: string;
  w?: string;
}) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-foreground/[0.06]",
        h,
        w,
        className
      )}
    />
  );
}
