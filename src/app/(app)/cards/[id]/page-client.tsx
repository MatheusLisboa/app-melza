"use client";

import { useAppShell } from "@/components/shared/app-shell";
import { CardDetailClient } from "./card-detail-client";

export function CardDetailPageClient({ cardId }: { cardId: string }) {
  const { member } = useAppShell();
  return <CardDetailClient member={member} cardId={cardId} />;
}
