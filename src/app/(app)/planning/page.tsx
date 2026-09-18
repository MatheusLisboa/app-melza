"use client";

import { useAppShell } from "@/components/shared/app-shell";
import { PlanningClient } from "./planning-client";

export default function PlanningPage() {
  const { member } = useAppShell();
  return <PlanningClient member={member} />;
}
