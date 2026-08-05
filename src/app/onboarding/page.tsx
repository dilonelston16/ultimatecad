import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import OnboardingClient from "./onboarding-client";

export default async function OnboardingPage() {
  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) redirect("/login?next=/onboarding");

  const { data: membership } = await supabase
    .from("community_memberships")
    .select("id")
    .eq("user_id", userData.user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (membership) redirect("/dashboard");

  return <OnboardingClient />;
}
