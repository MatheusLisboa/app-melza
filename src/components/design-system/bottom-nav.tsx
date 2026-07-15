"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  CreditCard,
  ArrowUpDown,
  Users,
  User,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type BottomNavId =
  | "dashboard"
  | "cards"
  | "transactions"
  | "entre-nos"
  | "profile";

const ALL_ITEMS: {
  id: BottomNavId;
  href: string;
  icon: LucideIcon;
  label: string;
  sharedOnly?: boolean;
}[] = [
  { id: "dashboard", href: "/dashboard", icon: Home, label: "Início" },
  { id: "cards", href: "/cards", icon: CreditCard, label: "Cartões" },
  {
    id: "transactions",
    href: "/transactions",
    icon: ArrowUpDown,
    label: "Histórico",
  },
  {
    id: "entre-nos",
    href: "/entre-nos",
    icon: Users,
    label: "Entre Nós",
    sharedOnly: true,
  },
  { id: "profile", href: "/settings", icon: User, label: "Perfil" },
];

function resolveActive(
  pathname: string,
  items: typeof ALL_ITEMS
): BottomNavId | null {
  for (const item of items) {
    if (pathname === item.href || pathname.startsWith(item.href + "/")) {
      return item.id;
    }
  }
  if (pathname.startsWith("/dashboard")) return "dashboard";
  return null;
}

export function BottomNav({
  className,
  showEntreNos = true,
}: {
  /** Aceito por compatibilidade; ícones usam tokens Melza. */
  wsColor?: string;
  className?: string;
  showEntreNos?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const items = useMemo(
    () =>
      ALL_ITEMS.filter((item) => (item.sharedOnly ? showEntreNos : true)),
    [showEntreNos]
  );

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  useEffect(() => {
    for (const item of items) {
      router.prefetch(item.href);
    }
  }, [router, items]);

  const activePath = pendingHref ?? pathname;
  const active = resolveActive(activePath, items);

  return (
    <nav
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center lg:hidden",
        "px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        className
      )}
      aria-label="Navegação principal"
    >
      <ul
        className={cn(
          "pointer-events-auto flex h-[60px] w-full max-w-md items-stretch justify-around gap-0.5",
          "rounded-[22px] border border-[var(--color-line)] px-1.5 py-1",
          "bg-[var(--color-card)]/92 shadow-[0_8px_32px_rgba(0,0,0,0.12)] backdrop-blur-xl",
          "dark:border-[#3A3A3C] dark:bg-[#1C1C1E]/92 dark:shadow-[0_8px_32px_rgba(0,0,0,0.45)]"
        )}
      >
        {items.map(({ id, href, icon: Icon, label }) => {
          const isActive = active === id;
          return (
            <li key={id} className="flex min-w-0 flex-1">
              <Link
                href={href}
                prefetch
                onClick={() => {
                  if (pathname !== href) setPendingHref(href);
                }}
                onTouchStart={() => router.prefetch(href)}
                className="relative flex h-full min-h-[44px] w-full flex-col items-center justify-center gap-0.5 px-0.5 active:opacity-80"
                aria-current={isActive ? "page" : undefined}
              >
                <span
                  className={cn(
                    "inline-flex max-w-full items-center gap-1 rounded-full px-3 py-1.5 transition-colors",
                    isActive
                      ? "bg-[var(--color-ink)] text-white dark:bg-[#F2F2F7] dark:text-[#111111]"
                      : "text-[var(--color-text-2)]"
                  )}
                >
                  <Icon size={18} strokeWidth={isActive ? 2.25 : 1.75} />
                  {isActive && (
                    <span className="max-w-[3.75rem] truncate text-[10px] font-semibold tracking-wide">
                      {label}
                    </span>
                  )}
                </span>
                {!isActive && (
                  <span className="mt-0.5 max-w-full truncate text-[9px] font-medium text-[var(--color-text-3)]">
                    {label}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
