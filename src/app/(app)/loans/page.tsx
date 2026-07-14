"use client";

import { useAppShell } from "@/components/shared/app-shell";
import { LoansClient } from "./loans-client";

export default function LoansPage() {
  const { member } = useAppShell();
  return <LoansClient member={member} />;
}
