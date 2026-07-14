"use client";

import { useAppShell } from "@/components/shared/app-shell";
import { TransactionDetailClient } from "./transaction-detail-client";

export default function TransactionDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { member } = useAppShell();
  return (
    <TransactionDetailClient member={member} transactionId={params.id} />
  );
}
