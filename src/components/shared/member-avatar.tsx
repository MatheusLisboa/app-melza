import { Avatar } from "@/components/design-system";
import { toDsMember } from "@/components/design-system/types";
import { cn } from "@/lib/utils";

interface MemberAvatarProps {
  name: string;
  color?: string;
  imageUrl?: string | null;
  size?: "sm" | "md" | "lg" | number;
  className?: string;
}

const sizeMap = {
  sm: 28,
  md: 36,
  lg: 48,
};

/** Wrapper legado → Make Avatar (foto ou 1ª letra) */
export function MemberAvatar({
  name,
  color = "#1C1C1E",
  imageUrl,
  size = "md",
  className,
}: MemberAvatarProps) {
  const px = typeof size === "number" ? size : sizeMap[size];
  return (
    <Avatar
      member={toDsMember({ id: name, name, color, imageUrl })}
      size={px}
      className={cn(className)}
    />
  );
}
