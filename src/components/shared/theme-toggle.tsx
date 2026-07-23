"use client";

import { Moon, Sun } from "lucide-react";
import { Btn } from "@/components/design-system";
import { useUiStore } from "@/lib/stores/ui-store";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);

  return (
    <Btn
      type="button"
      variant="ghost"
      size="sm"
      className={cn("h-9 w-9 min-h-0 px-0", className)}
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
    >
      {theme === "dark" ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </Btn>
  );
}
