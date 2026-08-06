import { AppShell } from "@/components/app-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import EconomyClient from "./economy-client";

export default async function EconomyPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/economy");

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
    .select("character_id,character:characters(id,first_name,last_name,state_id)")
    .eq("community_id", membership.community_id)
    .eq("user_id", user.id)
    .maybeSingle();

  const raw = active?.character;
  const character = Array.isArray(raw) ? raw[0] : raw;
  if (!character) redirect("/civilian");

  const [{ data: accounts },{ data: loans },{ data: businesses },{ data: jobs },{ data: bills },{ data: payments },{ data: inventory }] =
    await Promise.all([
      supabase.from("bank_accounts").select("*").eq("character_id",character.id).neq("status","closed"),
      supabase.from("loans").select("*").eq("character_id",character.id).order("created_at",{ascending:false}),
      supabase.from("businesses").select("*").eq("owner_character_id",character.id).order("created_at",{ascending:false}),
      supabase.from("employment_records").select("*").eq("character_id",character.id).eq("status","active"),
      supabase.from("bills").select("*").eq("character_id",character.id).order("due_at"),
      supabase.from("scheduled_payments").select("*").eq("character_id",character.id).eq("status","active").order("next_due_at"),
      supabase.from("character_inventory").select("*").eq("character_id",character.id).order("acquired_at",{ascending:false}).limit(12),
    ]);

  return (
    <AppShell title="Economy" subtitle={`${character.first_name} ${character.last_name} · ${character.state_id}`}>
      <EconomyClient
        character={character}
        accounts={accounts ?? []}
        loans={loans ?? []}
        businesses={businesses ?? []}
        jobs={jobs ?? []}
        bills={bills ?? []}
        payments={payments ?? []}
        inventory={inventory ?? []}
      />
    </AppShell>
  );
}
