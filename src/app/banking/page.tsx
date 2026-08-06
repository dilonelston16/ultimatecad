import { AppShell } from "@/components/app-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import BankingClient from "./banking-client";

export default async function BankingPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/banking");

  const { data: membership } = await supabase
    .from("community_memberships")
    .select("community_id,is_owner")
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

  const { data: accounts } = await supabase
    .from("bank_accounts")
    .select("*")
    .eq("character_id", character.id)
    .neq("status", "closed")
    .order("opened_at");

  const ids = (accounts ?? []).map((account) => account.id);
  const { data: transactions } = ids.length
    ? await supabase.from("bank_transactions").select("*").in("account_id", ids).order("created_at",{ascending:false}).limit(50)
    : { data: [] };

  let canManage = membership.is_owner === true;
  if (!canManage) {
    const { data } = await supabase.rpc("has_permission", {
      target_community_id: membership.community_id,
      requested_permission: "banking.manage",
    });
    canManage = data === true;
  }

  return (
    <AppShell title="Banking" subtitle={`${character.first_name} ${character.last_name} · ${character.state_id}`}>
      <BankingClient character={character} accounts={accounts ?? []} transactions={transactions ?? []} canManage={canManage} />
    </AppShell>
  );
}
