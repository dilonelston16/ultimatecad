import { AppShell } from "@/components/app-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import LeoDashboardClient from "./leo-dashboard-client";

export default async function LeoPage() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/leo");

  const { data: membership } = await supabase
    .from("community_memberships")
    .select("community_id,is_owner")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at")
    .limit(1)
    .maybeSingle();

  if (!membership) redirect("/onboarding");

  let canView = membership.is_owner === true;
  let canSelfDispatch = membership.is_owner === true;
  let canManageCalls = membership.is_owner === true;

  if (!canView) {
    const checks = await Promise.all([
      supabase.rpc("has_permission", {
        target_community_id: membership.community_id,
        requested_permission: "leo.view",
      }),
      supabase.rpc("has_permission", {
        target_community_id: membership.community_id,
        requested_permission: "leo.self_dispatch",
      }),
      supabase.rpc("has_permission", {
        target_community_id: membership.community_id,
        requested_permission: "leo.manage_calls",
      }),
    ]);

    canView = checks[0].data === true;
    canSelfDispatch = checks[1].data === true;
    canManageCalls = checks[2].data === true;
  }

  if (!canView) redirect("/dashboard?error=leo_access_required");

  const [
    profileResult,
    shiftResult,
    unitResult,
    callResult,
    assignmentResult,
    panicResult,
    boloResult,
    organizationResult,
    userProfileResult,
  ] = await Promise.all([
    supabase
      .from("leo_unit_profiles")
      .select("*")
      .eq("community_id", membership.community_id)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("leo_shifts")
      .select("*")
      .eq("community_id", membership.community_id)
      .eq("user_id", user.id)
      .is("clocked_out_at", null)
      .maybeSingle(),
    supabase
      .from("leo_shifts")
      .select(
        "id,status,current_assignment,clocked_in_at,last_status_at,unit:leo_unit_profiles(id,callsign,badge_number,rank_name,console_platform,supervisor,user:profiles(display_name,username,avatar_url))"
      )
      .eq("community_id", membership.community_id)
      .is("clocked_out_at", null)
      .order("clocked_in_at"),
    supabase
      .from("leo_calls")
      .select("*")
      .eq("community_id", membership.community_id)
      .in("status", ["open", "assigned"])
      .order("priority")
      .order("created_at", { ascending: false }),
    supabase
      .from("leo_call_assignments")
      .select("id,call_id,shift_id,assigned_at,cleared_at")
      .eq("community_id", membership.community_id)
      .is("cleared_at", null),
    supabase
      .from("leo_panic_alerts")
      .select(
        "id,shift_id,location,message,status,activated_at,unit:leo_shifts(unit:leo_unit_profiles(callsign,user:profiles(display_name,username)))"
      )
      .eq("community_id", membership.community_id)
      .eq("status", "active")
      .order("activated_at", { ascending: false }),
    supabase
      .from("leo_bolos")
      .select("*")
      .eq("community_id", membership.community_id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("organization_nodes")
      .select("id,parent_id,node_type,name,sort_order")
      .eq("community_id", membership.community_id)
      .order("sort_order"),
    supabase
      .from("profiles")
      .select("display_name,username,avatar_url")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  const errors = [
    profileResult.error?.message,
    shiftResult.error?.message,
    unitResult.error?.message,
    callResult.error?.message,
    assignmentResult.error?.message,
    panicResult.error?.message,
    boloResult.error?.message,
    organizationResult.error?.message,
  ].filter(Boolean);

  return (
    <AppShell
      title="LEO / MDT"
      subtitle="Live law-enforcement operations, units, calls, panic alerts, and records search."
    >
      <LeoDashboardClient
        communityId={membership.community_id}
        userProfile={userProfileResult.data}
        unitProfile={profileResult.data}
        activeShift={shiftResult.data}
        units={unitResult.data ?? []}
        calls={callResult.data ?? []}
        assignments={assignmentResult.data ?? []}
        panicAlerts={panicResult.data ?? []}
        bolos={boloResult.data ?? []}
        organization={organizationResult.data ?? []}
        canSelfDispatch={canSelfDispatch}
        canManageCalls={canManageCalls}
        loadError={errors.join(" | ")}
      />
    </AppShell>
  );
}
