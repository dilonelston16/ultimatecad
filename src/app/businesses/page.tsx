import { AppShell } from "@/components/app-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import BusinessesClient from "./businesses-client";

export default async function BusinessesPage() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/businesses");
  }

  const { data: membership } = await supabase
    .from("community_memberships")
    .select("community_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at")
    .limit(1)
    .maybeSingle();

  if (!membership) {
    redirect("/onboarding");
  }

  const { data: active } = await supabase
    .from("active_characters")
    .select(
      "character_id,character:characters(id,first_name,last_name,state_id)"
    )
    .eq("community_id", membership.community_id)
    .eq("user_id", user.id)
    .maybeSingle();

  const rawCharacter = active?.character;
  const character = Array.isArray(rawCharacter)
    ? rawCharacter[0]
    : rawCharacter;

  if (!character) {
    redirect("/civilian");
  }

  // Load ownerships separately. This avoids PostgREST failures caused by
  // filtering through an embedded business_members relationship.
  const { data: ownedBusinesses, error: ownedError } = await supabase
    .from("businesses")
    .select("*")
    .eq("community_id", membership.community_id)
    .eq("owner_character_id", character.id)
    .order("created_at", { ascending: false });

  const { data: memberships, error: membershipError } = await supabase
    .from("business_members")
    .select("business_id")
    .eq("community_id", membership.community_id)
    .eq("character_id", character.id)
    .eq("status", "active");

  const memberBusinessIds = (memberships ?? []).map(
    (item) => item.business_id
  );

  const { data: memberBusinesses, error: memberBusinessError } =
    memberBusinessIds.length > 0
      ? await supabase
          .from("businesses")
          .select("*")
          .eq("community_id", membership.community_id)
          .in("id", memberBusinessIds)
          .order("created_at", { ascending: false })
      : { data: [], error: null };

  const businessMap = new Map<string, any>();

  for (const business of [
    ...(ownedBusinesses ?? []),
    ...(memberBusinesses ?? []),
  ]) {
    businessMap.set(business.id, business);
  }

  const businesses = Array.from(businessMap.values());
  const businessIds = businesses.map((business) => business.id);
  const accountIds = businesses
    .map((business) => business.business_bank_account_id)
    .filter(Boolean);

  const [{ data: accounts }, { data: members }, { data: stores }] =
    await Promise.all([
      accountIds.length
        ? supabase
            .from("bank_accounts")
            .select(
              "id,account_number,name,balance,available_balance,status"
            )
            .in("id", accountIds)
        : Promise.resolve({ data: [] }),
      businessIds.length
        ? supabase
            .from("business_members")
            .select(
              "id,business_id,character_id,role_name,pay_type,pay_rate,status,character:characters(id,first_name,last_name,state_id)"
            )
            .in("business_id", businessIds)
            .order("hired_at")
        : Promise.resolve({ data: [] }),
      businessIds.length
        ? supabase
            .from("stores")
            .select("id,business_id,name,description,status")
            .in("business_id", businessIds)
            .order("created_at")
        : Promise.resolve({ data: [] }),
    ]);

  const accountsById = new Map(
    (accounts ?? []).map((account: any) => [account.id, account])
  );

  const hydratedBusinesses = businesses.map((business) => ({
    ...business,
    bank_account:
      accountsById.get(business.business_bank_account_id) ?? null,
    members: (members ?? []).filter(
      (member: any) => member.business_id === business.id
    ),
    stores: (stores ?? []).filter(
      (store: any) => store.business_id === business.id
    ),
  }));

  const pageError =
    ownedError?.message ??
    membershipError?.message ??
    memberBusinessError?.message ??
    "";

  return (
    <AppShell
      title="Businesses"
      subtitle={`${character.first_name} ${character.last_name} · ${character.state_id}`}
    >
      <BusinessesClient
        character={character}
        businesses={hydratedBusinesses}
        loadError={pageError}
      />
    </AppShell>
  );
}
