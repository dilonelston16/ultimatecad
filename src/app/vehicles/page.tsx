import { AppShell } from "@/components/app-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import VehiclesClient from "./vehicles-client";

export default async function VehiclesPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/vehicles");

  const { data: membership } = await supabase
    .from("community_memberships")
    .select("community_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at")
    .limit(1)
    .maybeSingle();

  if (!membership) redirect("/onboarding");

  const { data: active } = await supabase
    .from("active_characters")
    .select("character_id,character:characters(id,first_name,last_name,state_id)")
    .eq("community_id", membership.community_id)
    .eq("user_id", user.id)
    .maybeSingle();

  const characterRaw = active?.character;
  const character = Array.isArray(characterRaw) ? characterRaw[0] : characterRaw;

  if (!character) {
    return (
      <AppShell title="Vehicles" subtitle="Registration and ownership">
        <div style={{ padding: 24 }}>Create and select a character before registering a vehicle.</div>
      </AppShell>
    );
  }

  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("*,insurance_policies(id,policy_number,provider_name,status,coverage_type,expires_at)")
    .eq("primary_owner_character_id", character.id)
    .order("created_at", { ascending: false });

  const { data: transfers } = await supabase
    .from("vehicle_transfer_requests")
    .select("id,vehicle_id,status,sale_price,created_at,to_character:characters!vehicle_transfer_requests_to_character_id_fkey(first_name,last_name,state_id)")
    .eq("from_character_id", character.id)
    .order("created_at", { ascending: false });

  return (
    <AppShell title="Vehicles" subtitle={`${character.first_name} ${character.last_name} · ${character.state_id}`}>
      <VehiclesClient character={character} vehicles={vehicles ?? []} transfers={transfers ?? []} />
    </AppShell>
  );
}
