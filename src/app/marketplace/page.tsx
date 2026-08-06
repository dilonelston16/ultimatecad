import { AppShell } from "@/components/app-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import MarketplaceClient from "./marketplace-client";

export default async function MarketplacePage(){
  const supabase=await createServerSupabaseClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect("/login?next=/marketplace");

  const {data:membership}=await supabase.from("community_memberships").select("community_id").eq("user_id",user.id).eq("status","active").order("created_at").limit(1).maybeSingle();
  if(!membership)redirect("/onboarding");

  const {data:active}=await supabase.from("active_characters").select("character:characters(id,first_name,last_name,state_id)").eq("community_id",membership.community_id).eq("user_id",user.id).maybeSingle();
  const raw=active?.character; const character=Array.isArray(raw)?raw[0]:raw;
  if(!character)redirect("/civilian");

  const [{data:listings},{data:items},{data:vehicles},{data:weapons},{data:properties},{data:businesses},{data:accounts}]=await Promise.all([
    supabase.from("marketplace_listings").select("*,seller:characters!marketplace_listings_seller_character_id_fkey(first_name,last_name,state_id)").eq("community_id",membership.community_id).eq("status","active").order("created_at",{ascending:false}),
    supabase.from("character_inventory").select("id,item_name,quantity,listed_quantity,status,product:store_products(sku,category)").eq("character_id",character.id).in("status",["owned","listed"]),
    supabase.from("vehicles").select("id,make,model,model_year,plate_number,status").eq("primary_owner_character_id",character.id),
    supabase.from("weapons").select("id,make,model,serial_number,status").eq("owner_character_id",character.id),
    supabase.from("properties").select("id,property_type,address,property_number,status").eq("owner_character_id",character.id),
    supabase.from("businesses").select("id,name,business_number,status").eq("owner_character_id",character.id),
    supabase.from("bank_accounts").select("id,name,account_number,status").eq("character_id",character.id).eq("status","active"),
  ]);

  return <AppShell title="Marketplace" subtitle="List only items and assets that your active character owns.">
    <MarketplaceClient character={character} listings={listings??[]} ownership={{items:items??[],vehicles:vehicles??[],weapons:weapons??[],properties:properties??[],businesses:businesses??[]}} accounts={accounts??[]}/>
  </AppShell>;
}
