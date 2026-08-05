import { AppShell } from "@/components/app-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Activity, BadgeCheck, BriefcaseBusiness, Building, CalendarDays, Car, CreditCard, Home, MapPin, Phone, Plus, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import CharacterCards from "./character-cards";

function ageFromDob(value:string){const dob=new Date(`${value}T00:00:00`);const today=new Date();let age=today.getFullYear()-dob.getFullYear();const m=today.getMonth()-dob.getMonth();if(m<0||(m===0&&today.getDate()<dob.getDate()))age--;return age;}

export default async function CivilianPage(){
 const supabase=await createServerSupabaseClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user)redirect('/login?next=/civilian');
 const {data:membership}=await supabase.from('community_memberships').select('community_id,community:communities(name,prefix)').eq('user_id',user.id).eq('status','active').limit(1).maybeSingle(); if(!membership)redirect('/onboarding');
 const [{data:characters},{data:active}]=await Promise.all([
  supabase.from('characters').select('id,state_id,first_name,middle_name,last_name,date_of_birth,gender,phone_number,address,occupation,status,is_archived,photo_url,created_at').eq('community_id',membership.community_id).eq('owner_user_id',user.id).order('created_at',{ascending:true}),
  supabase.from('active_characters').select('character_id').eq('community_id',membership.community_id).eq('user_id',user.id).maybeSingle()
 ]);
 const activeCharacter=(characters??[]).find(c=>c.id===active?.character_id&&!c.is_archived)??(characters??[]).find(c=>!c.is_archived);
 const characterIds=(characters??[]).map(c=>c.id);
 const [{data:licenses},{data:applications},{data:timeline}]=await Promise.all([
  characterIds.length?supabase.from('licenses').select('id,character_id,license_number,status,expires_at,license_type:license_types(name,category)').in('character_id',characterIds):Promise.resolve({data:[]}),
  characterIds.length?supabase.from('license_applications').select('id,character_id,application_number,status,created_at,license_type:license_types(name)').in('character_id',characterIds).order('created_at',{ascending:false}):Promise.resolve({data:[]}),
  activeCharacter?supabase.from('character_timeline').select('id,title,description,created_at,event_type').eq('character_id',activeCharacter.id).order('created_at',{ascending:false}).limit(6):Promise.resolve({data:[]})
 ]);
 const communityRaw=membership.community; const community=(Array.isArray(communityRaw)?communityRaw[0]:communityRaw) as {name:string;prefix:string}|null;
 const activeLicenses=(licenses??[]).filter((l:any)=>l.character_id===activeCharacter?.id&&l.status==='valid');
 return <AppShell title="Civilian" subtitle={`${community?.name??'Community'} · Identity, licenses and civilian services`}>
  <div className="civilian-page civilian-page-v2">
   <section className="civilian-profile-hero">
    <div className="civilian-profile-photo">{activeCharacter?.photo_url?<img src={activeCharacter.photo_url} alt=""/>:<span>{activeCharacter?`${activeCharacter.first_name[0]}${activeCharacter.last_name[0]}`:'UC'}</span>}</div>
    <div className="civilian-profile-copy"><span className="eyebrow">Active character</span><div className="civilian-title-row"><h2>{activeCharacter?`${activeCharacter.first_name} ${activeCharacter.last_name}`:'No active character'}</h2>{activeCharacter&&<span className="active-badge"><BadgeCheck size={14}/>Active</span>}</div><p>{activeCharacter?`${activeCharacter.state_id} · ${ageFromDob(activeCharacter.date_of_birth)} years old · ${activeCharacter.occupation||'Unemployed'}`:'Create your first civilian identity to enter the community ecosystem.'}</p><div className="civilian-contact-row">{activeCharacter?.phone_number&&<span><Phone size={14}/>{activeCharacter.phone_number}</span>}{activeCharacter?.address&&<span><MapPin size={14}/>{activeCharacter.address}</span>}</div></div>
    <div className="civilian-hero-actions">{activeCharacter&&<Link className="button secondary" href={`/civilian/characters/${activeCharacter.id}`}>View full profile</Link>}<Link className="button primary" href="/civilian/characters/new"><Plus size={17}/>New character</Link></div>
   </section>

   <section className="civilian-service-grid">
    <Link href="/licenses" className="civilian-service-card"><ShieldCheck/><div><span>Licenses</span><strong>{activeLicenses.length}</strong><small>{activeLicenses.length?'Valid credentials':'Apply through the DMV'}</small></div></Link>
    <article className="civilian-service-card muted"><Car/><div><span>Vehicles</span><strong>0</strong><small>Registration module coming next</small></div></article>
    <article className="civilian-service-card muted"><CreditCard/><div><span>Bank accounts</span><strong>0</strong><small>Banking system prepared</small></div></article>
    <article className="civilian-service-card muted"><BriefcaseBusiness/><div><span>Businesses</span><strong>0</strong><small>Business ownership prepared</small></div></article>
   </section>

   <div className="civilian-content-grid">
    <section className="panel character-section"><div className="panel-heading"><div><span className="eyebrow">Identity management</span><h2>My characters</h2><p>Switch, review and preserve every civilian identity.</p></div></div><CharacterCards initialCharacters={characters??[]} initialActiveId={active?.character_id??null}/></section>
    <section className="panel civilian-summary-panel"><div className="panel-heading"><div><span className="eyebrow">Active identity</span><h2>At a glance</h2></div></div>{activeCharacter?<dl className="civilian-detail-list"><div><dt><UserRound/>Legal name</dt><dd>{activeCharacter.first_name} {activeCharacter.middle_name?`${activeCharacter.middle_name} `:''}{activeCharacter.last_name}</dd></div><div><dt><CalendarDays/>Date of birth</dt><dd>{new Date(`${activeCharacter.date_of_birth}T00:00:00`).toLocaleDateString()}</dd></div><div><dt><Building/>Occupation</dt><dd>{activeCharacter.occupation||'Not assigned'}</dd></div><div><dt><Home/>Address</dt><dd>{activeCharacter.address||'Not assigned'}</dd></div></dl>:<div className="empty-state">No active character selected.</div>}</section>
   </div>

   <div className="civilian-content-grid lower">
    <section className="panel"><div className="panel-heading"><div><span className="eyebrow">Recent activity</span><h2>Character timeline</h2></div>{activeCharacter&&<Link href={`/civilian/characters/${activeCharacter.id}`} className="text-link">View all</Link>}</div><div className="activity-list">{(timeline??[]).length?(timeline??[]).map((e:any)=><article key={e.id}><span className="activity-icon"><Activity size={15}/></span><div><b>{e.title}</b><p>{e.description}</p><small>{new Date(e.created_at).toLocaleString()}</small></div></article>):<div className="empty-state">No recent character activity.</div>}</div></section>
    <section className="panel"><div className="panel-heading"><div><span className="eyebrow">DMV services</span><h2>Applications and credentials</h2></div><Link className="button compact" href="/licenses">Open DMV</Link></div><div className="license-mini-list">{activeLicenses.slice(0,3).map((l:any)=><article key={l.id}><ShieldCheck/><div><b>{Array.isArray(l.license_type)?l.license_type[0]?.name:l.license_type?.name}</b><code>{l.license_number}</code><small>Expires {new Date(l.expires_at).toLocaleDateString()}</small></div></article>)}{!activeLicenses.length&&<div className="empty-state">No valid licenses yet. Submit an application to begin testing.</div>}</div>{(applications??[]).some((a:any)=>a.character_id===activeCharacter?.id)&&<p className="panel-footnote">You have active or historical DMV applications on file.</p>}</section>
   </div>
  </div>
 </AppShell>;
}
