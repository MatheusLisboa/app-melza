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
import { workspaceAccent, isSharedWorkspace } from "@/lib/utils/workspace";

const SIDEBAR_NAV: {
  href: string;
  label: string;
  icon: LucideIcon;
  sharedOnly?: boolean;
}[] = [
  { href: "/dashboard", label: "Início", icon: Home },
  { href: "/transactions", label: "Histórico", icon: ArrowUpDown },
  { href: "/cards", label: "Cartões", icon: CreditCard },
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
  accent,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  accent: string;
}) {
  const router = useRouter();

  return (
    <Link
      href={href}
      prefetch
      onMouseEnter={() => router.prefetch(href)}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
        active
          ? "font-medium"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
      style={
        active
          ? { backgroundColor: `${accent}26`, color: accent }
          : undefined
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </Link>
  );
}

export function AppSidebar({
  member,
  memberships,
}: {
  member: WorkspaceMember;
  memberships: MembershipOption[];
}) {
  const pathname = usePathname();
  const accent = workspaceAccent(member.workspace?.type).color;
  const shared = isSharedWorkspace(member.workspace?.type);
  const navItems = SIDEBAR_NAV.filter((item) =>
    item.sharedOnly ? shared : true
  );

  return (
    <aside className="hidden h-full w-60 shrink-0 flex-col overflow-hidden border-r border-border/60 bg-card/40 lg:flex">
      <div className="flex shrink-0 items-center justify-between gap-1 border-b border-border/60 px-2 py-3">
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
              accent={accent}
            />
          );
        })}
      </nav>
      <div className="shrink-0 border-t border-border/60 p-4">
        <div className="flex items-center gap-3">
          <MemberAvatar
            name={member.display_name}
            color={member.avatar_color}
            size="sm"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{member.display_name}</p>
            <p className="text-xs capitalize text-muted-foreground">
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
        "flex shrink-0 items-center justify-between gap-2 border-b border-border/60 bg-background/90 px-3 py-2 lg:hidden",
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
        <ThemeToggle />
        <Link href="/settings" aria-label="Perfil" className="pressable">
          <MemberAvatar
            name={member.display_name}
            color={member.avatar_color}
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
}: {
  wsColor?: string;
  showEntreNos?: boolean;
}) {
  return (
    <BottomNav
      wsColor={wsColor ?? "#6366F1"}
      showEntreNos={showEntreNos ?? true}
    />
  );
}

export { Settings };
