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

/** Make: BottomNav — optimistic + prefetch + safe-area */
export function BottomNav({
  wsColor = "#6366F1",
  className,
  showEntreNos = true,
}: {
  wsColor?: string;
  className?: string;
  /** Entre Nós só em workspace compartilhado */
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
        "fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.06] lg:hidden",
        "pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5",
        className
      )}
      style={{
        background: "rgba(9,9,11,0.94)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
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
                <span className="relative">
                  <Icon
                    size={22}
                    strokeWidth={isActive ? 2.5 : 1.75}
                    style={{
                      color: isActive ? wsColor : "rgba(255,255,255,0.32)",
                    }}
                  />
                  {isActive && (
                    <span
                      className="absolute -bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full"
                      style={{ backgroundColor: wsColor }}
                    />
                  )}
                </span>
                <span
                  className="mt-0.5 max-w-full truncate text-[10px] font-medium"
                  style={{
                    color: isActive ? wsColor : "rgba(255,255,255,0.32)",
                  }}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
