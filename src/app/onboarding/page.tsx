import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { needsSharedWorkspaceOnboarding } from "@/lib/supabase/workspace";
import { OnboardingForm } from "@/components/shared/onboarding-form";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/onboarding");
  }

  if (!(await needsSharedWorkspaceOnboarding())) {
    redirect("/dashboard");
  }

  const displayName =
    (user.user_metadata?.display_name as string | undefined) ||
    user.email?.split("@")[0] ||
    "";

  return <OnboardingForm defaultDisplayName={displayName} allowSkip />;
}
