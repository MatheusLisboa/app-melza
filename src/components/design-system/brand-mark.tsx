import { cn } from "@/lib/utils";

function MelzaMPath({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <g transform="skewX(-10) translate(4 0)">
        <path
          fill="currentColor"
          d="M9.2 49.2 18.6 14.4h7.1L36 35.6 45.1 14.4h7.1L43.4 49.2h-7.3l5.6-20.4L33.4 49.2h-5.1L20 28.8l-4.1 20.4H9.2Z"
        />
      </g>
    </svg>
  );
}

/**
 * Melza — monograma M itálico, preto e branco.
 */
export function BrandMark({
  size = "md",
  className,
  inverted = false,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Fundo branco / M preto */
  inverted?: boolean;
}) {
  const sizes = {
    sm: "h-9 w-9 rounded-[10px]",
    md: "h-14 w-14 rounded-2xl",
    lg: "h-20 w-20 rounded-[22px]",
  };

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden",
        inverted ? "bg-white text-black" : "bg-black text-white",
        sizes[size],
        className
      )}
      aria-label="Melza"
      role="img"
    >
      <MelzaMPath className="h-[78%] w-[78%]" />
    </div>
  );
}

/** Wordmark “Melza” com mark */
export function BrandWordmark({
  size = "md",
  className,
  markClassName,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
  markClassName?: string;
}) {
  const text = {
    sm: "text-base font-semibold tracking-tight",
    md: "text-2xl font-semibold tracking-tight",
    lg: "text-3xl font-semibold tracking-tight",
  };

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <BrandMark size={size === "lg" ? "md" : size} className={markClassName} />
      <span
        className={cn("text-foreground", text[size])}
        style={{ fontStyle: "italic", letterSpacing: "-0.035em" }}
      >
        Melza
      </span>
    </div>
  );
}
