"use client";

import { useAppShell } from "@/components/shared/app-shell";
import { CardDetailClient } from "./card-detail-client";

export default function CardDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { member } = useAppShell();
  return <CardDetailClient member={member} cardId={params.id} />;
}
