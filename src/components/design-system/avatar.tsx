import { cn } from "@/lib/utils";
import type { DsMember } from "./types";

/** Avatar — círculo night, letra branca */
export function Avatar({
  member,
  size = 36,
  className,
}: {
  member: DsMember;
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-bold text-white",
        className
      )}
      style={{
        width: size,
        height: size,
        backgroundColor: member.color || "#1C1C1E",
        fontSize: size * 0.36,
      }}
      title={member.name}
    >
      {(member.initials || member.name)[0]}
    </div>
  );
}
