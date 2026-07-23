"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  ArrowUpDown,
  CreditCard,
  Receipt,
  Settings,
  Repeat,
  HandCoins,
  MessageCircle,
  Users,
  User,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { BrandMark, BottomNav } from "@/components/design-system";
import {
  WorkspaceSwitcher,
  type MembershipOption,
} from "@/components/shared/workspace-switcher";
import type { WorkspaceMember } from "@/types";
import { isSharedWorkspace } from "@/lib/utils/workspace";

const SIDEBAR_NAV: {
  href: string;
  label: string;
  icon: LucideIcon;
  sharedOnly?: boolean;
}[] = [
  { href: "/dashboard", label: "Início", icon: Home },
  { href: "/transactions", label: "Histórico", icon: ArrowUpDown },
  { href: "/cards", label: "Cartões", icon: CreditCard },
  { href: "/accounts", label: "Contas", icon: Wallet },
  { href: "/entre-nos", label: "Entre Nós", icon: Users, sharedOnly: true },
  { href: "/invoices", label: "Faturas", icon: Receipt },
  { href: "/subscriptions", label: "Assinaturas", icon: Repeat },
  { href: "/loans", label: "Empréstimos", icon: HandCoins },
  { href: "/chat", label: "Chat IA", icon: MessageCircle },
  { href: "/reports", label: "Relatórios", icon: Receipt },
  { href: "/settings", label: "Perfil", icon: User },
];

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  badge,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  badge?: boolean;
}) {
  const router = useRouter();

  return (
    <Link
      href={href}
      prefetch
      onMouseEnter={() => router.prefetch(href)}
      className={cn(
        "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
        active
          ? "bg-[var(--color-chip)] font-semibold text-[var(--color-text)]"
          : "text-[var(--color-text-2)] hover:bg-[var(--color-chip)] hover:text-[var(--color-text)]"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1 truncate">{label}</span>
      {badge ? (
        <span
          className="h-2 w-2 shrink-0 rounded-full bg-[#EF4444]"
          aria-label="Saldo pendente"
        />
      ) : null}
    </Link>
  );
}

export function AppSidebar({
  member,
  memberships,
  entreNosBadge,
}: {
  member: WorkspaceMember;
  memberships: MembershipOption[];
  entreNosBadge?: boolean;
}) {
  const pathname = usePathname();
  const shared = isSharedWorkspace(member.workspace?.type);
  const navItems = SIDEBAR_NAV.filter((item) =>
    item.sharedOnly ? shared : true
  );

  return (
    <aside className="hidden h-full w-60 shrink-0 flex-col overflow-hidden border-r border-[var(--color-line)] bg-[var(--color-card)] lg:flex">
      <div className="flex shrink-0 items-center justify-between gap-1 border-b border-[var(--color-line)] px-2 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <BrandMark size="sm" className="shrink-0" />
          <WorkspaceSwitcher member={member} memberships={memberships} />
        </div>
        <ThemeToggle />
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto p-3">
        {navItems.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              active={active}
              badge={item.href === "/entre-nos" ? entreNosBadge : false}
            />
          );
        })}
      </nav>
      <div className="shrink-0 border-t border-[var(--color-line)] p-4">
        <div className="flex items-center gap-3">
          <MemberAvatar
            name={member.display_name}
            color={member.avatar_color}
            imageUrl={member.avatar_url}
            size="sm"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-[var(--color-text)]">
              {member.display_name}
            </p>
            <p className="text-xs capitalize text-[var(--color-text-2)]">
              {member.role}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}

export function MobileHeader({
  member,
  memberships,
}: {
  member: WorkspaceMember;
  memberships: MembershipOption[];
}) {
  return (
    <header
      className={cn(
        "flex shrink-0 items-center justify-between gap-2 border-b border-[var(--color-line)] bg-[var(--color-card)] px-3 py-2 lg:hidden",
        "pt-[max(0.5rem,env(safe-area-inset-top))]"
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <BrandMark
          size="sm"
          className="!h-8 !w-8 shrink-0 !rounded-lg !text-xs"
        />
        <WorkspaceSwitcher
          member={member}
          memberships={memberships}
          compact
        />
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Link
          href="/chat"
          aria-label="Chat IA"
          className="touch-target pressable inline-flex h-11 w-11 items-center justify-center rounded-full text-[var(--color-text-2)] hover:bg-[var(--color-chip)] hover:text-[var(--color-text)]"
        >
          <MessageCircle className="h-5 w-5" />
        </Link>
        <ThemeToggle />
        <Link href="/settings" aria-label="Perfil" className="pressable">
          <MemberAvatar
            name={member.display_name}
            color={member.avatar_color}
            imageUrl={member.avatar_url}
            size="sm"
          />
        </Link>
      </div>
    </header>
  );
}

/** Make BottomNav — 5 itens em compartilhado; sem Entre Nós no pessoal */
export function MobileNav({
  wsColor,
  showEntreNos,
  entreNosBadge,
}: {
  wsColor?: string;
  showEntreNos?: boolean;
  entreNosBadge?: boolean;
}) {
  return (
    <BottomNav
      wsColor={wsColor ?? "#111111"}
      showEntreNos={showEntreNos ?? true}
      entreNosBadge={entreNosBadge}
    />
  );
}

export { Settings };
