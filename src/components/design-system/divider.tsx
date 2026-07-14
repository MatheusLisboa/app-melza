import { cn } from "@/lib/utils";

/** Make: Divider */
export function Divider({ className }: { className?: string }) {
  return (
    <div className={cn("mx-0 h-px bg-white/[0.06]", className)} />
  );
}
