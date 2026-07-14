import type { Category } from "@/types";
import { Badge } from "@/components/ui/badge";
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
      <Badge variant="secondary" className={cn("font-normal", className)}>
        Sem categoria
      </Badge>
    );
  }

  return (
    <Badge
      variant="secondary"
      className={cn("gap-1 font-normal", className)}
      style={{
        backgroundColor: `${category.color}22`,
        color: category.color,
        borderColor: `${category.color}44`,
      }}
    >
      <span>{category.icon}</span>
      {category.name}
    </Badge>
  );
}
