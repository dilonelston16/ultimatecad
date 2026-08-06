import { AppShell } from "@/components/app-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import BusinessesClient from "./businesses-client";

export default async function BusinessesPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/businesses");

  const { data: membership } = await supabase.from("community_memberships").select("community_id").eq("user_id",user.id).eq("status","active").order("created_at").limit(1).maybeSingle();
  if (!membership) redirect("/onboarding");
  const { data: active } = await supabase.from("active_characters").select("character:characters(id,first_name,last_name,state_id)").eq("community_id",membership.community_id).eq("user_id",user.id).maybeSingle();
  const raw=active?.character; const character=Array.isArray(raw)?raw[0]:raw;
  if (!character) redirect("/civilian");

  const { data: owned } = await supabase.from("businesses").select("*").eq("community_id",membership.community_id).eq("owner_character_id",character.id).order("created_at",{ascending:false});
  const { data: memberRows } = await supabase.from("business_members").select("business_id").eq("community_id",membership.community_id).eq("character_id",character.id).eq("status","active");
  const memberIds=(memberRows??[]).map(r=>r.business_id);
  const {data:employed}=memberIds.length?await supabase.from("businesses").select("*").in("id",memberIds):{data:[]};
  const map=new Map<string,any>(); [...(owned??[]),...(employed??[])].forEach(b=>map.set(b.id,b));
  const businesses=Array.from(map.values()); const ids=businesses.map(b=>b.id); const accountIds=businesses.map(b=>b.business_bank_account_id).filter(Boolean);

  const [{data:accounts},{data:members},{data:transactions},{data:payroll},{data:stores},{data:inventory},{data:expenses}] = await Promise.all([
    accountIds.length?supabase.from("bank_accounts").select("*").in("id",accountIds):Promise.resolve({data:[]}),
    ids.length?supabase.from("business_members").select("*,character:characters(id,first_name,last_name,state_id)").in("business_id",ids).order("role_level",{ascending:false}):Promise.resolve({data:[]}),
    accountIds.length?supabase.from("bank_transactions").select("*").in("account_id",accountIds).order("created_at",{ascending:false}).limit(150):Promise.resolve({data:[]}),
    ids.length?supabase.from("payroll_runs").select("*").in("business_id",ids).order("created_at",{ascending:false}):Promise.resolve({data:[]}),
    ids.length?supabase.from("stores").select("*,categories:store_categories(*),products:store_products(*)").in("business_id",ids):Promise.resolve({data:[]}),
    ids.length?supabase.from("business_inventory").select("*,product:store_products(id,sku,category,price)").in("business_id",ids).order("updated_at",{ascending:false}):Promise.resolve({data:[]}),
    ids.length?supabase.from("business_expenses").select("*").in("business_id",ids).order("created_at",{ascending:false}).limit(100):Promise.resolve({data:[]}),
  ]);

  const hydrated=businesses.map(b=>({
    ...b,
    bank_account:(accounts??[]).find((a:any)=>a.id===b.business_bank_account_id)??null,
    members:(members??[]).filter((m:any)=>m.business_id===b.id),
    transactions:(transactions??[]).filter((t:any)=>t.account_id===b.business_bank_account_id),
    payrollRuns:(payroll??[]).filter((p:any)=>p.business_id===b.id),
    store:(stores??[]).find((s:any)=>s.business_id===b.id)??null,
    inventory:(inventory??[]).filter((i:any)=>i.business_id===b.id),
    expenses:(expenses??[]).filter((e:any)=>e.business_id===b.id),
  }));

  return <AppShell title="Businesses" subtitle={`${character.first_name} ${character.last_name} · ${character.state_id}`}>
    <BusinessesClient character={character} businesses={hydrated}/>
  </AppShell>;
}
