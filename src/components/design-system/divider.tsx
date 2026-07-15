import { cn } from "@/lib/utils";

/** Divider Melza v2 */
export function Divider({ className }: { className?: string }) {
  return <div className={cn("mx-0 h-px bg-[#E5E5EA]", className)} />;
}
