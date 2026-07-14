import { cn } from "@/lib/utils";

/** Logo mark Figma Make — adaptado para FinançasCasa */
export function BrandMark({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = {
    sm: "h-9 w-9 text-sm rounded-xl",
    md: "h-14 w-14 text-2xl rounded-2xl",
    lg: "h-20 w-20 text-4xl rounded-3xl",
  };

  return (
    <div
      className={cn(
        "flex items-center justify-center font-bold text-white",
        sizes[size],
        className
      )}
      style={{
        background: "linear-gradient(135deg, #6366F1, #8B5CF6)",
        letterSpacing: "-0.04em",
      }}
    >
      FC
    </div>
  );
}
