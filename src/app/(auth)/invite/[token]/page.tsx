import { InviteAcceptForm } from "@/components/shared/invite-accept-form";

export default async function InviteTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <InviteAcceptForm token={token} />
    </main>
  );
}
