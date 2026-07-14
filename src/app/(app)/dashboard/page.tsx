"use client";

import { useAppShell } from "@/components/shared/app-shell";
import { DashboardClient } from "./dashboard-client";

export default function DashboardPage() {
  const { member, memberships } = useAppShell();
  return <DashboardClient member={member} memberships={memberships} />;
}
