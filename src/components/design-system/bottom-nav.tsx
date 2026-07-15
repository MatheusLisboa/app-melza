"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  CreditCard,
  ArrowUpDown,
  MessageCircle,
  LayoutGrid,
  Wallet,
  Receipt,
  Repeat,
  HandCoins,
  Users,
  BarChart3,
  User,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export type BottomNavId =
  | "dashboard"
  | "transactions"
  | "chat"
  | "cards"
  | "more";

const PRIMARY: {
  id: BottomNavId;
  href: string;
  icon: LucideIcon;
  label: string;
}[] = [
  { id: "dashboard", href: "/dashboard", icon: Home, label: "Início" },
  {
    id: "transactions",
    href: "/transactions",
    icon: ArrowUpDown,
    label: "Histórico",
  },
  { id: "chat", href: "/chat", icon: MessageCircle, label: "IA" },
  { id: "cards", href: "/cards", icon: CreditCard, label: "Cartões" },
];

const MORE_PATHS = [
  "/accounts",
  "/invoices",
  "/subscriptions",
  "/loans",
  "/reports",
  "/entre-nos",
  "/settings",
] as const;

type MoreLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  sharedOnly?: boolean;
};

const MORE_LINKS: MoreLink[] = [
  { href: "/accounts", label: "Contas", icon: Wallet },
  { href: "/invoices", label: "Faturas", icon: Receipt },
  { href: "/subscriptions", label: "Assinaturas", icon: Repeat },
  { href: "/loans", label: "Empréstimos", icon: HandCoins },
  { href: "/reports", label: "Relatórios", icon: BarChart3 },
  { href: "/entre-nos", label: "Entre Nós", icon: Users, sharedOnly: true },
  { href: "/settings", label: "Perfil", icon: User },
];

function resolveActive(pathname: string): BottomNavId | null {
  if (pathname === "/chat" || pathname.startsWith("/chat/")) return "chat";
  if (pathname === "/cards" || pathname.startsWith("/cards/")) return "cards";
  if (
    pathname === "/transactions" ||
    pathname.startsWith("/transactions/")
  ) {
    return "transactions";
  }
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    return "dashboard";
  }
  if (MORE_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return "more";
  }
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
  const [moreOpen, setMoreOpen] = useState(false);

  const moreLinks = useMemo(
    () => MORE_LINKS.filter((l) => (l.sharedOnly ? showEntreNos : true)),
    [showEntreNos]
  );

  useEffect(() => {
    setPendingHref(null);
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    for (const item of PRIMARY) {
      router.prefetch(item.href);
    }
    for (const link of moreLinks) {
      router.prefetch(link.href);
    }
  }, [router, moreLinks]);

  const activePath = pendingHref ?? pathname;
  const active = resolveActive(activePath);

  return (
    <>
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
          {PRIMARY.map(({ id, href, icon: Icon, label }) => {
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

          <li className="flex min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className="relative flex h-full min-h-[44px] w-full flex-col items-center justify-center gap-0.5 px-0.5 active:opacity-80"
              aria-label="Mais módulos"
              aria-expanded={moreOpen}
            >
              <span
                className={cn(
                  "inline-flex max-w-full items-center gap-1 rounded-full px-3 py-1.5 transition-colors",
                  active === "more"
                    ? "bg-[var(--color-ink)] text-white dark:bg-[#F2F2F7] dark:text-[#111111]"
                    : "text-[var(--color-text-2)]"
                )}
              >
                <LayoutGrid
                  size={18}
                  strokeWidth={active === "more" ? 2.25 : 1.75}
                />
                {active === "more" && (
                  <span className="max-w-[3.75rem] truncate text-[10px] font-semibold tracking-wide">
                    Mais
                  </span>
                )}
              </span>
              {active !== "more" && (
                <span className="mt-0.5 max-w-full truncate text-[9px] font-medium text-[var(--color-text-3)]">
                  Mais
                </span>
              )}
            </button>
          </li>
        </ul>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl border-[var(--color-line)] bg-[var(--color-card)] pb-[max(1.5rem,env(safe-area-inset-bottom))] lg:hidden"
        >
          <SheetHeader className="text-left">
            <SheetTitle className="text-[var(--color-text)]">
              Mais
            </SheetTitle>
          </SheetHeader>
          <ul className="mt-4 grid grid-cols-2 gap-2">
            {moreLinks.map(({ href, label, icon: Icon }) => {
              const isHere =
                pathname === href || pathname.startsWith(href + "/");
              return (
                <li key={href}>
                  <Link
                    href={href}
                    prefetch
                    onClick={() => {
                      setPendingHref(href);
                      setMoreOpen(false);
                    }}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors",
                      isHere
                        ? "bg-[var(--color-chip)] font-semibold text-[var(--color-text)]"
                        : "text-[var(--color-text-2)] hover:bg-[var(--color-chip)]"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </SheetContent>
      </Sheet>
    </>
  );
}
