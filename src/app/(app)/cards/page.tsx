"use client";

import { useAppShell } from "@/components/shared/app-shell";
import { CardsPageClient } from "./cards-client";

export default function CardsPage() {
  const { member } = useAppShell();
  return <CardsPageClient member={member} />;
}
