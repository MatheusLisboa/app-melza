import type { Category } from "@/types";
import { Badge } from "@/components/design-system";
import { cn } from "@/lib/utils";

export function CategoryBadge({
  category,
  className,
}: {
  category: Pick<Category, "name" | "icon" | "color"> | null | undefined;
  className?: string;
}) {
  if (!category) {
    return (
      <Badge status="fixed" className={cn("font-normal", className)}>
        Sem categoria
      </Badge>
    );
  }

  return (
    <Badge
      status="custom"
      bg={`${category.color}22`}
      color={category.color}
      className={cn("font-normal", className)}
    >
      <span>{category.icon}</span>
      {category.name}
    </Badge>
  );
}
