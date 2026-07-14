"use client";

import { useAppShell } from "@/components/shared/app-shell";
import { InvoicesClient } from "./invoices-client";

export default function InvoicesPage() {
  const { member } = useAppShell();
  return <InvoicesClient member={member} />;
}
