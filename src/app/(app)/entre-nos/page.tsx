"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppShell } from "@/components/shared/app-shell";
import { isSharedWorkspace } from "@/lib/utils/workspace";
import { DsSkeleton } from "@/components/design-system";
import { EntreNosClient } from "./entre-nos-client";

function EntreNosBody() {
  const { member } = useAppShell();
  const router = useRouter();
  const shared = isSharedWorkspace(member.workspace?.type);

  useEffect(() => {
    if (!shared) router.replace("/dashboard");
  }, [shared, router]);

  if (!shared) return null;

  return <EntreNosClient member={member} />;
}

export default function EntreNosPage() {
  return (
    <Suspense
      fallback={
        <div className="page-pad space-y-3">
          <DsSkeleton h="h-12" className="rounded-xl" />
          <DsSkeleton h="h-40" className="rounded-xl" />
          <DsSkeleton h="h-28" className="rounded-xl" />
        </div>
      }
    >
      <EntreNosBody />
    </Suspense>
  );
}
