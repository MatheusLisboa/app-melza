"use client";

import {
  Baby,
  Briefcase,
  Car,
  Clapperboard,
  Gift,
  GraduationCap,
  HandCoins,
  HeartPulse,
  Home,
  Landmark,
  Lightbulb,
  Package,
  PawPrint,
  Repeat,
  Shirt,
  ShoppingBag,
  TrendingUp,
  Utensils,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BY_NAME: Record<string, LucideIcon> = {
  alimentação: Utensils,
  alimentacao: Utensils,
  moradia: Home,
  transporte: Car,
  saúde: HeartPulse,
  saude: HeartPulse,
  educação: GraduationCap,
  educacao: GraduationCap,
  lazer: Clapperboard,
  vestuário: Shirt,
  vestuario: Shirt,
  "contas & utilities": Lightbulb,
  contas: Lightbulb,
  utilities: Lightbulb,
  pets: PawPrint,
  presentes: Gift,
  "presente recebido": Gift,
  empréstimos: HandCoins,
  emprestimos: HandCoins,
  assinaturas: Repeat,
  outros: Package,
  salário: Wallet,
  salario: Wallet,
  freelance: Briefcase,
  investimentos: TrendingUp,
  reembolso: Landmark,
  mercado: ShoppingBag,
  filhos: Baby,
};

const BY_EMOJI: Record<string, LucideIcon> = {
  "🍕": Utensils,
  "🏠": Home,
  "🚗": Car,
  "🏥": HeartPulse,
  "📚": GraduationCap,
  "🎬": Clapperboard,
  "👗": Shirt,
  "💡": Lightbulb,
  "🐾": PawPrint,
  "🎁": Gift,
  "💸": HandCoins,
  "🔄": Repeat,
  "📦": Package,
  "💰": Wallet,
  "🏦": Briefcase,
  "💹": TrendingUp,
  "💳": Landmark,
};

export function categoryIconFor(
  name?: string | null,
  emoji?: string | null
): LucideIcon {
  if (name) {
    const key = name.trim().toLowerCase();
    if (BY_NAME[key]) return BY_NAME[key];
    for (const [k, icon] of Object.entries(BY_NAME)) {
      if (key.includes(k)) return icon;
    }
  }
  if (emoji && BY_EMOJI[emoji]) return BY_EMOJI[emoji];
  return Package;
}

export function CategoryGlyph({
  name,
  emoji,
  className,
  iconClassName,
  size = 16,
}: {
  name?: string | null;
  emoji?: string | null;
  className?: string;
  iconClassName?: string;
  size?: number;
}) {
  const Icon = categoryIconFor(name, emoji);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-[var(--color-icon)] text-white",
        className
      )}
    >
      <Icon
        size={size}
        strokeWidth={1.75}
        className={iconClassName}
        aria-hidden
      />
    </span>
  );
}
