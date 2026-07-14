import { AppShellProvider } from "@/components/shared/app-shell";

/** Layout fino — shell no client (sem Supabase a cada troca de aba). */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShellProvider>{children}</AppShellProvider>;
}
