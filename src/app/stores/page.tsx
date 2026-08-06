import { AppShell } from "@/components/app-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import StoresClient from "./stores-client";
export default async function StoresPage(){
 const supabase=await createServerSupabaseClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login?next=/stores");
 const {data:membership}=await supabase.from("community_memberships").select("community_id,is_owner").eq("user_id",user.id).eq("status","active").order("created_at").limit(1).maybeSingle();if(!membership)redirect("/onboarding");
 const {data:active}=await supabase.from("active_characters").select("character:characters(id,first_name,last_name,state_id)").eq("community_id",membership.community_id).eq("user_id",user.id).maybeSingle();const raw=active?.character;const character=Array.isArray(raw)?raw[0]:raw;if(!character)redirect("/civilian");
 const [{data:stores},{data:accounts},{data:businesses}]=await Promise.all([
  supabase.from("stores").select("*,business:businesses(id,name,business_number,owner_character_id),products:store_products(*)").eq("community_id",membership.community_id).eq("status","active").order("store_type").order("name"),
  supabase.from("bank_accounts").select("id,name,account_number,available_balance,status").eq("character_id",character.id).eq("status","active").order("opened_at"),
  supabase.from("businesses").select("id,name,business_number,business_bank_account_id,account:bank_accounts!businesses_business_bank_account_id_fkey(id,name,account_number,available_balance,status)").eq("owner_character_id",character.id).eq("status","active")
 ]);
 let canRestock=membership.is_owner===true;if(!canRestock){const {data}=await supabase.rpc("has_permission",{target_community_id:membership.community_id,requested_permission:"stores.restock"});canRestock=data===true}
 return <AppShell title="Stores" subtitle="Buy personally or purchase inventory for one of your businesses."><StoresClient character={character} stores={stores??[]} accounts={accounts??[]} businesses={businesses??[]} canRestock={canRestock}/></AppShell>
}
