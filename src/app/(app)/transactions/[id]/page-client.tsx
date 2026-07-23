"use client";

import { useAppShell } from "@/components/shared/app-shell";
import { TransactionDetailClient } from "./transaction-detail-client";

export function TransactionDetailPageClient({
  transactionId,
}: {
  transactionId: string;
}) {
  const { member } = useAppShell();
  return (
    <TransactionDetailClient member={member} transactionId={transactionId} />
  );
}
