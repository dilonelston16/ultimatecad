import { AppShell } from "@/components/app-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import CharacterForm from "./character-form";
export default async function NewCharacterPage(){const supabase=await createServerSupabaseClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login?next=/civilian/characters/new');const {data:m}=await supabase.from('community_memberships').select('id').eq('user_id',user.id).eq('status','active').limit(1).maybeSingle();if(!m)redirect('/onboarding');return <AppShell title="Create Character" subtitle="Build a permanent civilian identity with an automatically generated State ID"><CharacterForm/></AppShell>}
