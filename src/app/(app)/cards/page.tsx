"use client";

import { useAppShell } from "@/components/shared/app-shell";
import { CardsAccountsPage } from "./cards-client";

export default function CardsPage() {
  const { member } = useAppShell();
  return <CardsAccountsPage member={member} />;
}
