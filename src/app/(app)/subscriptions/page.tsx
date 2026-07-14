"use client";

import { useAppShell } from "@/components/shared/app-shell";
import { SubscriptionsClient } from "./subscriptions-client";

export default function SubscriptionsPage() {
  const { member } = useAppShell();
  return <SubscriptionsClient member={member} />;
}
