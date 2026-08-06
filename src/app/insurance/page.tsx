import { AppShell } from "@/components/app-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import InsuranceClient from "./insurance-client";

export default async function InsurancePage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/insurance");

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

  const raw = active?.character;
  const character = Array.isArray(raw) ? raw[0] : raw;
  if (!character) redirect("/civilian");

  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("id,plate_number,make,model,model_year,status")
    .eq("primary_owner_character_id", character.id)
    .order("created_at");

  const { data: policies } = await supabase
    .from("insurance_policies")
    .select("*,vehicle:vehicles(id,plate_number,make,model,model_year)")
    .eq("character_id", character.id)
    .order("created_at", { ascending: false });

  return (
    <AppShell title="Insurance" subtitle={`${character.first_name} ${character.last_name} · ${character.state_id}`}>
      <InsuranceClient character={character} vehicles={vehicles ?? []} policies={policies ?? []} />
    </AppShell>
  );
}
