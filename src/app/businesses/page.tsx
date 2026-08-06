import { AppShell } from "@/components/app-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import BusinessesClient from "./businesses-client";

export default async function BusinessesPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

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
    .select("character_id,character:characters(id,first_name,last_name,state_id)")
    .eq("community_id", membership.community_id)
    .eq("user_id", user.id)
    .maybeSingle();

  const rawCharacter = active?.character;
  const character = Array.isArray(rawCharacter)
    ? rawCharacter[0]
    : rawCharacter;

  if (!character) redirect("/civilian");

  const { data: owned } = await supabase
    .from("businesses")
    .select("*")
    .eq("community_id", membership.community_id)
    .eq("owner_character_id", character.id)
    .order("created_at", { ascending: false });

  const { data: memberRows } = await supabase
    .from("business_members")
    .select("business_id")
    .eq("community_id", membership.community_id)
    .eq("character_id", character.id)
    .eq("status", "active");

  const memberIds = (memberRows ?? []).map((row) => row.business_id);
  const { data: employed } = memberIds.length
    ? await supabase
        .from("businesses")
        .select("*")
        .in("id", memberIds)
    : { data: [] };

  const map = new Map<string, any>();
  [...(owned ?? []), ...(employed ?? [])].forEach((business) =>
    map.set(business.id, business)
  );

  const businesses = Array.from(map.values());
  const ids = businesses.map((business) => business.id);
  const accountIds = businesses
    .map((business) => business.business_bank_account_id)
    .filter(Boolean);

  const [{ data: accounts }, { data: members }, { data: transactions }, { data: payroll }] =
    await Promise.all([
      accountIds.length
        ? supabase.from("bank_accounts").select("*").in("id", accountIds)
        : Promise.resolve({ data: [] }),
      ids.length
        ? supabase
            .from("business_members")
            .select("*,character:characters(id,first_name,last_name,state_id)")
            .in("business_id", ids)
            .order("role_level", { ascending: false })
        : Promise.resolve({ data: [] }),
      accountIds.length
        ? supabase
            .from("bank_transactions")
            .select("*")
            .in("account_id", accountIds)
            .order("created_at", { ascending: false })
            .limit(100)
        : Promise.resolve({ data: [] }),
      ids.length
        ? supabase
            .from("payroll_runs")
            .select("*")
            .in("business_id", ids)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);

  const hydrated = businesses.map((business) => ({
    ...business,
    bank_account:
      (accounts ?? []).find(
        (account: any) => account.id === business.business_bank_account_id
      ) ?? null,
    members: (members ?? []).filter(
      (member: any) => member.business_id === business.id
    ),
    transactions: (transactions ?? []).filter(
      (transaction: any) =>
        transaction.account_id === business.business_bank_account_id
    ),
    payrollRuns: (payroll ?? []).filter(
      (run: any) => run.business_id === business.id
    ),
  }));

  return (
    <AppShell
      title="Businesses"
      subtitle={`${character.first_name} ${character.last_name} · ${character.state_id}`}
    >
      <BusinessesClient character={character} businesses={hydrated} />
    </AppShell>
  );
}
