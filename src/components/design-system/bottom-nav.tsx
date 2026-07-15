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
  wsColor: _wsColor,
  className,
  showEntreNos = true,
}: {
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
        "fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-line)] bg-[var(--color-card)] lg:hidden",
        "pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5",
        className
      )}
      aria-label="Navegação principal"
    >
      <ul className="mx-auto flex h-[58px] max-w-lg items-stretch justify-around px-1">
        {items.map(({ id, href, icon: Icon, label }) => {
          const isActive = active === id;
          return (
            <li key={id} className="flex-1">
              <Link
                href={href}
                prefetch
                onClick={() => {
                  if (pathname !== href) setPendingHref(href);
                }}
                onTouchStart={() => router.prefetch(href)}
                className="relative flex h-full min-h-[44px] w-full flex-col items-center justify-center gap-0.5 px-1 active:opacity-80"
                aria-current={isActive ? "page" : undefined}
              >
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 transition-colors",
                    isActive
                      ? "bg-[var(--color-ink)] text-white dark:bg-[var(--color-chip)] dark:text-[#111]"
                      : "text-[var(--color-text-2)]"
                  )}
                >
                  <Icon size={18} strokeWidth={isActive ? 2.25 : 1.75} />
                  {isActive && (
                    <span className="max-w-[4.5rem] truncate text-[10px] font-semibold tracking-wide">
                      {label}
                    </span>
                  )}
                </span>
                {!isActive && (
                  <span className="mt-0.5 max-w-full truncate text-[10px] font-medium text-[var(--color-text-2)]">
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
