import { cn } from "@/lib/utils";
import type { DsMember } from "./types";

/** Avatar — foto ou círculo com inicial */
export function Avatar({
  member,
  size = 36,
  className,
}: {
  member: DsMember;
  size?: number;
  className?: string;
}) {
  const letter = (member.initials || member.name)[0]?.toUpperCase() ?? "?";

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold text-white",
        className
      )}
      style={{
        width: size,
        height: size,
        backgroundColor: member.imageUrl
          ? "transparent"
          : member.color || "#1C1C1E",
        fontSize: size * 0.36,
      }}
      title={member.name}
    >
      {member.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={member.imageUrl}
          alt={member.name}
          className="h-full w-full object-cover"
        />
      ) : (
        letter
      )}
    </div>
  );
}
