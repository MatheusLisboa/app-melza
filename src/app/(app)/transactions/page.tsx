"use client";

import { useAppShell } from "@/components/shared/app-shell";
import { TransactionsPageClient } from "@/components/transactions/transaction-list";

export default function TransactionsPage() {
  const { member } = useAppShell();
  return <TransactionsPageClient member={member} />;
}
