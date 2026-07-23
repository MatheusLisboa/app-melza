import { TransactionDetailPageClient } from "./page-client";

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TransactionDetailPageClient transactionId={id} />;
}
