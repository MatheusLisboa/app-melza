import { CardDetailPageClient } from "./page-client";

export default async function CardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CardDetailPageClient cardId={id} />;
}
