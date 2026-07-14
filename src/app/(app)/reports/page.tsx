"use client";

import { useAppShell } from "@/components/shared/app-shell";
import { ReportsClient } from "./reports-client";

export default function ReportsPage() {
  const { member } = useAppShell();
  return <ReportsClient member={member} />;
}
