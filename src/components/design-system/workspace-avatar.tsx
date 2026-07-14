import { cn } from "@/lib/utils";
import type { DsWorkspaceVisual } from "./types";

/** Make: WorkspaceAvatar — rounded-2xl + emoji */
export function WorkspaceAvatar({
  ws,
  size = 40,
  className,
}: {
  ws: DsWorkspaceVisual;
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-2xl",
        className
      )}
      style={{
        width: size,
        height: size,
        background: `${ws.color}22`,
        fontSize: size * 0.5,
      }}
      title={ws.name}
    >
      {ws.emoji}
    </div>
  );
}
