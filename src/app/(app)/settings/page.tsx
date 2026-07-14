"use client";

import { useAppShell } from "@/components/shared/app-shell";
import { SettingsClient } from "./settings-client";

export default function SettingsPage() {
  const { member } = useAppShell();
  return <SettingsClient member={member} />;
}
