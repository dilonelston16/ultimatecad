import { AppShell } from "@/components/app-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import RedeemAccess from "./redeem-access";
export default async function AccessPage(){const supabase=await createServerSupabaseClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login?next=/community/access');const {data:m}=await supabase.from('community_memberships').select('community:communities(name)').eq('user_id',user.id).eq('status','active').limit(1).maybeSingle();if(!m)redirect('/onboarding');const raw=m.community;const c=(Array.isArray(raw)?raw[0]:raw) as {name:string}|null;return <AppShell title="Department Access" subtitle={`${c?.name??'Community'} · Redeem a permission key`}><RedeemAccess/></AppShell>}
