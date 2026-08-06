import { AppShell } from "@/components/app-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import BankingClient from "./banking-client";

export default async function BankingPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/banking");

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

  if (!character) {
    return (
      <AppShell title="Banking" subtitle="Accounts and transactions">
        <div style={{ padding: 24 }}>
          Create and select a character before opening a bank account.
        </div>
      </AppShell>
    );
  }

  const { data: accounts } = await supabase
    .from("bank_accounts")
    .select("*")
    .eq("character_id", character.id)
    .neq("status", "closed")
    .order("opened_at");

  const accountIds = (accounts ?? []).map((account) => account.id);

  const { data: transactions } = accountIds.length
    ? await supabase
        .from("bank_transactions")
        .select("*")
        .in("account_id", accountIds)
        .order("created_at", { ascending: false })
        .limit(50)
    : { data: [] };

  return (
    <AppShell
      title="Banking"
      subtitle={`${character.first_name} ${character.last_name} · ${character.state_id}`}
    >
      <BankingClient
        character={character}
        accounts={accounts ?? []}
        transactions={transactions ?? []}
      />
    </AppShell>
  );
}
