import { cn } from "@/lib/utils";
import type { DsMember } from "./types";

/** Make: Avatar — círculo, 1ª letra, size numérico */
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
        "flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
        className
      )}
      style={{
        width: size,
        height: size,
        backgroundColor: member.color,
        fontSize: size * 0.36,
      }}
      title={member.name}
    >
      {(member.initials || member.name)[0]}
    </div>
  );
}
