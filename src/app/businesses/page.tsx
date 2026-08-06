import { AppShell } from "@/components/app-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import BusinessesClient from "./businesses-client";

export default async function BusinessesPage() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/businesses");

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
    .select(
      "character_id,character:characters(id,first_name,last_name,state_id)"
    )
    .eq("community_id", membership.community_id)
    .eq("user_id", user.id)
    .maybeSingle();

  const raw = active?.character;
  const character = Array.isArray(raw) ? raw[0] : raw;

  if (!character) redirect("/civilian");

  const { data: businesses } = await supabase
    .from("businesses")
    .select(
      "*,bank_account:bank_accounts!businesses_business_bank_account_id_fkey(id,account_number,name,balance,available_balance,status),members:business_members(id,character_id,role_name,pay_type,pay_rate,status,character:characters(first_name,last_name,state_id))"
    )
    .or(
      `owner_character_id.eq.${character.id},members.character_id.eq.${character.id}`
    )
    .order("created_at", { ascending: false });

  return (
    <AppShell
      title="Businesses"
      subtitle={`${character.first_name} ${character.last_name} · ${character.state_id}`}
    >
      <BusinessesClient
        character={character}
        businesses={businesses ?? []}
      />
    </AppShell>
  );
}
