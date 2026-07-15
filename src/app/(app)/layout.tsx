import { AppShellProvider } from "@/components/shared/app-shell";
import { getAppShell } from "@/lib/supabase/workspace";
import { redirect } from "next/navigation";

/** Resolve shell no servidor — evita waterfall client /api/shell no cold start. */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const shell = await getAppShell();
  if (!shell?.member) {
    redirect("/login");
  }

  const initialData = {
    member: shell.member,
    memberships: shell.memberships,
  };

  return (
    <AppShellProvider initialData={initialData}>{children}</AppShellProvider>
  );
}
