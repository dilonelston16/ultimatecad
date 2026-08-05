import { AppShell } from "@/components/app-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DmvManagementClient from "./dmv-management-client";

export default async function DmvPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/dmv");

  const { data: membership } = await supabase
    .from("community_memberships")
    .select("community_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at")
    .limit(1)
    .maybeSingle();

  if (!membership) redirect("/onboarding");

  const { data: allowed } = await supabase.rpc("has_permission", {
    p_community_id: membership.community_id,
    p_permission_key: "dmv.manage",
  });

  if (!allowed) redirect("/dashboard");

  const { data: applications } = await supabase
    .from("license_applications")
    .select(
      "id,application_number,status,written_status,practical_status,created_at,character:characters(first_name,last_name,state_id),license_type:license_types(name,code)"
    )
    .eq("community_id", membership.community_id)
    .eq("status", "ready_for_review")
    .order("created_at");

  const { data: licenses } = await supabase
    .from("licenses")
    .select(
      "id,license_number,status,points,issued_at,expires_at,character:characters(first_name,last_name,state_id),license_type:license_types(name,code,category)"
    )
    .eq("community_id", membership.community_id)
    .order("issued_at", { ascending: false });

  return (
    <AppShell
      title="DMV Administration"
      subtitle="Review applications and manage issued licenses."
    >
      <div className="dmv-admin-page">
        <DmvManagementClient
          applications={applications ?? []}
          licenses={licenses ?? []}
        />
      </div>
    </AppShell>
  );
}
