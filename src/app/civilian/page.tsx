import { AppShell } from "@/components/app-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Archive, ArrowRight, BadgeCheck, BriefcaseBusiness, Car, CreditCard, Plus, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import CharacterCards from "./character-cards";

export default async function CivilianPage() {
  const supabase = await createServerSupabaseClient();
  const { data:{user} } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/civilian");

  const { data: membership } = await supabase.from("community_memberships")
    .select("community_id,community:communities(name,prefix)").eq("user_id",user.id).eq("status","active").limit(1).maybeSingle();
  if (!membership) redirect("/onboarding");

  const [{data:characters},{data:active}] = await Promise.all([
    supabase.from("characters").select("id,state_id,first_name,middle_name,last_name,date_of_birth,gender,phone_number,address,occupation,status,is_archived,photo_url,created_at")
      .eq("community_id",membership.community_id).eq("owner_user_id",user.id).order("created_at",{ascending:true}),
    supabase.from("active_characters").select("character_id").eq("community_id",membership.community_id).eq("user_id",user.id).maybeSingle(),
  ]);
  const activeCharacter = (characters ?? []).find(c=>c.id===active?.character_id && !c.is_archived) ?? (characters ?? []).find(c=>!c.is_archived);
  const communityRaw=membership.community; const community=(Array.isArray(communityRaw)?communityRaw[0]:communityRaw) as {name:string;prefix:string}|null;

  return <AppShell title="Civilian" subtitle={`${community?.name ?? "Community"} · Characters, identity and civilian records`}>
    <div className="civilian-page">
      <section className="civilian-hero">
        <div><span className="eyebrow">Active identity</span><h2>{activeCharacter ? `${activeCharacter.first_name} ${activeCharacter.last_name}` : "Create your first character"}</h2><p>{activeCharacter ? `${activeCharacter.state_id} · ${activeCharacter.occupation || "No occupation assigned"}` : "Every civilian record begins with a permanent State ID."}</p></div>
        <Link className="button primary" href="/civilian/characters/new"><Plus size={17}/>New character</Link>
      </section>

      <div className="civilian-stat-grid">
        <article><UserRound/><span>Characters</span><strong>{(characters ?? []).filter(c=>!c.is_archived).length}</strong><small>Active civilian identities</small></article>
        <article><BadgeCheck/><span>Licenses</span><strong>0</strong><small>DMV milestone coming next</small></article>
        <article><Car/><span>Vehicles</span><strong>0</strong><small>Registered to active character</small></article>
        <article><CreditCard/><span>Accounts</span><strong>0</strong><small>Banking module prepared</small></article>
      </div>

      <section className="panel character-section">
        <div className="panel-heading"><div><span className="eyebrow">Identity management</span><h2>My characters</h2></div><Link href="/civilian/characters/new" className="button secondary"><Plus size={16}/>Create character</Link></div>
        <CharacterCards initialCharacters={characters ?? []} initialActiveId={active?.character_id ?? null}/>
      </section>

      <div className="civilian-module-grid">
        {[['Licenses','Driver and weapon licenses generated automatically.',ShieldCheck],['Vehicles','VINs, registration, plates and ownership history.',Car],['Businesses','Ownership, employment, payroll and business licenses.',BriefcaseBusiness],['Archive','Inactive and archived character records remain preserved.',Archive]].map(([title,description,Icon]:any)=><article className="civilian-module" key={title}><Icon/><div><b>{title}</b><p>{description}</p></div><ArrowRight size={17}/></article>)}
      </div>
    </div>
  </AppShell>;
}
