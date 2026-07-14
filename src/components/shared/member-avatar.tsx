import { Avatar } from "@/components/design-system";
import { toDsMember } from "@/components/design-system/types";
import { cn } from "@/lib/utils";

interface MemberAvatarProps {
  name: string;
  color?: string;
  size?: "sm" | "md" | "lg" | number;
  className?: string;
}

const sizeMap = {
  sm: 28,
  md: 36,
  lg: 48,
};

/** Wrapper legado → Make Avatar (1ª letra, size numérico) */
export function MemberAvatar({
  name,
  color = "#6366f1",
  size = "md",
  className,
}: MemberAvatarProps) {
  const px = typeof size === "number" ? size : sizeMap[size];
  return (
    <Avatar
      member={toDsMember({ id: name, name, color })}
      size={px}
      className={cn(className)}
    />
  );
}
