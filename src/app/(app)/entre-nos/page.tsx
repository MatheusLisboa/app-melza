"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppShell } from "@/components/shared/app-shell";
import { isSharedWorkspace } from "@/lib/utils/workspace";
import { EntreNosClient } from "./entre-nos-client";

export default function EntreNosPage() {
  const { member } = useAppShell();
  const router = useRouter();
  const shared = isSharedWorkspace(member.workspace?.type);

  useEffect(() => {
    if (!shared) router.replace("/dashboard");
  }, [shared, router]);

  if (!shared) return null;

  return <EntreNosClient member={member} />;
}
