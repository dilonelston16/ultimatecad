import { AppShell } from '@/components/app-shell';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { BadgeCheck, CalendarClock, FileCheck2, Shield, ShieldAlert } from 'lucide-react';
import { redirect } from 'next/navigation';
import LicenseApplicationPanel from './license-application-panel';

export default async function LicensesPage(){
 const supabase=await createServerSupabaseClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login?next=/licenses');
 const {data:membership}=await supabase.from('community_memberships').select('community_id,community:communities(name)').eq('user_id',user.id).eq('status','active').limit(1).maybeSingle();if(!membership)redirect('/onboarding');
 const {data:active}=await supabase.from('active_characters').select('character_id,character:characters(id,state_id,first_name,last_name)').eq('community_id',membership.community_id).eq('user_id',user.id).maybeSingle();
 if(!active?.character_id)redirect('/civilian');
 const [{data:types},{data:applications},{data:licenses}]=await Promise.all([
  supabase.from('license_types').select('*').eq('community_id',membership.community_id).eq('active',true).order('category').order('name'),
  supabase.from('license_applications').select('*,license_type:license_types(name,code,category),tests:license_tests(test_type,status,score,completed_at)').eq('character_id',active.character_id).order('created_at',{ascending:false}),
  supabase.from('licenses').select('*,license_type:license_types(name,code,category)').eq('character_id',active.character_id).order('issued_at',{ascending:false})
 ]);
 const charRaw=active.character;const character=(Array.isArray(charRaw)?charRaw[0]:charRaw) as any;
 return <AppShell title="Licenses & DMV" subtitle={`${character?.first_name} ${character?.last_name} · ${character?.state_id}`}><div className="licenses-page">
  <section className="dmv-hero"><div><span className="eyebrow">Department of Motor Vehicles</span><h2>Licenses, testing and renewals</h2><p>Apply for driver and weapon credentials. Every approved credential receives a permanent community-prefixed license number.</p></div><div className="dmv-hero-badge"><Shield/><span>Identity verified</span><b>{character?.state_id}</b></div></section>
  <div className="license-stat-grid"><article><BadgeCheck/><span>Valid licenses</span><strong>{(licenses??[]).filter((l:any)=>l.status==='valid').length}</strong></article><article><FileCheck2/><span>Applications</span><strong>{(applications??[]).length}</strong></article><article><CalendarClock/><span>Awaiting action</span><strong>{(applications??[]).filter((a:any)=>['submitted','testing','ready_for_review'].includes(a.status)).length}</strong></article><article><ShieldAlert/><span>Points</span><strong>{(licenses??[]).reduce((n:number,l:any)=>n+(l.points??0),0)}</strong></article></div>
  <LicenseApplicationPanel characterId={active.character_id} types={types??[]} applications={applications??[]} licenses={licenses??[]}/>
 </div></AppShell>;
}
