import { AppShell } from "@/components/app-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import InventoryClient from "./inventory-client";

export default async function InventoryPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/inventory");

  const { data: membership } = await supabase
    .from("community_memberships")
    .select("community_id")
    .eq("user_id",user.id).eq("status","active")
    .order("created_at").limit(1).maybeSingle();
  if (!membership) redirect("/onboarding");

  const { data: active } = await supabase
    .from("active_characters")
    .select("character:characters(id,first_name,last_name,state_id)")
    .eq("community_id",membership.community_id)
    .eq("user_id",user.id).maybeSingle();

  const raw=active?.character;
  const character=Array.isArray(raw)?raw[0]:raw;
  if (!character) redirect("/civilian");

  const [{data:items},{data:vehicles},{data:weapons},{data:properties},{data:businesses}] =
    await Promise.all([
      supabase.from("character_inventory").select("*,product:store_products(id,sku,category,product_type)").eq("character_id",character.id).neq("status","consumed").order("acquired_at",{ascending:false}),
      supabase.from("vehicles").select("id,plate_number,vin,make,model,model_year,status").eq("primary_owner_character_id",character.id).order("created_at",{ascending:false}),
      supabase.from("weapons").select("id,serial_number,registration_number,weapon_type,make,model,caliber,status").eq("owner_character_id",character.id).order("created_at",{ascending:false}),
      supabase.from("properties").select("id,property_number,property_type,address,status,garage_spaces").eq("owner_character_id",character.id).order("created_at",{ascending:false}),
      supabase.from("businesses").select("id,business_number,name,business_type,status").eq("owner_character_id",character.id).order("created_at",{ascending:false}),
    ]);

  return (
    <AppShell title="Inventory & Assets" subtitle={`${character.first_name} ${character.last_name} · ${character.state_id}`}>
      <InventoryClient items={items??[]} vehicles={vehicles??[]} weapons={weapons??[]} properties={properties??[]} businesses={businesses??[]} />
    </AppShell>
  );
}
