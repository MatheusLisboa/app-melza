"use client";

import { useAppShell } from "@/components/shared/app-shell";
import { AccountsPageClient } from "./accounts-client";

export default function AccountsPage() {
  const { member } = useAppShell();
  return <AccountsPageClient member={member} />;
}
