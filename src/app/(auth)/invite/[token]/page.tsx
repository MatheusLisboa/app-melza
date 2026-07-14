import { InviteAcceptForm } from "@/components/shared/invite-accept-form";

export default function InviteTokenPage({
  params,
}: {
  params: { token: string };
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <InviteAcceptForm token={params.token} />
    </main>
  );
}
