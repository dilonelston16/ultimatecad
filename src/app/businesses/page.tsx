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
      "character:characters(id,first_name,last_name,state_id)"
    )
    .eq("community_id", membership.community_id)
    .eq("user_id", user.id)
    .maybeSingle();

  const rawCharacter = active?.character;
  const character = Array.isArray(rawCharacter)
    ? rawCharacter[0]
    : rawCharacter;

  if (!character) redirect("/civilian");

  const { data: owned, error: ownedError } = await supabase
    .from("businesses")
    .select("*")
    .eq("community_id", membership.community_id)
    .eq("owner_character_id", character.id)
    .order("created_at", { ascending: false });

  const { data: memberRows, error: memberRowsError } = await supabase
    .from("business_members")
    .select("business_id")
    .eq("community_id", membership.community_id)
    .eq("character_id", character.id)
    .eq("status", "active");

  const memberIds = (memberRows ?? []).map((row) => row.business_id);

  const { data: employed, error: employedError } = memberIds.length
    ? await supabase
        .from("businesses")
        .select("*")
        .eq("community_id", membership.community_id)
        .in("id", memberIds)
    : { data: [], error: null };

  const businessMap = new Map<string, any>();

  for (const business of [...(owned ?? []), ...(employed ?? [])]) {
    businessMap.set(business.id, business);
  }

  const businesses = Array.from(businessMap.values());
  const businessIds = businesses.map((business) => business.id);
  const accountIds = businesses
    .map((business) => business.business_bank_account_id)
    .filter(Boolean);

  const [
    accountsResult,
    membersResult,
    transactionsResult,
    payrollResult,
    storesResult,
    inventoryResult,
    expensesResult,
  ] = await Promise.all([
    accountIds.length
      ? supabase
          .from("bank_accounts")
          .select("*")
          .in("id", accountIds)
      : Promise.resolve({ data: [], error: null }),

    businessIds.length
      ? supabase
          .from("business_members")
          .select(
            "*,character:characters(id,first_name,last_name,state_id)"
          )
          .in("business_id", businessIds)
          .order("role_level", { ascending: false })
      : Promise.resolve({ data: [], error: null }),

    accountIds.length
      ? supabase
          .from("bank_transactions")
          .select("*")
          .in("account_id", accountIds)
          .order("created_at", { ascending: false })
          .limit(150)
      : Promise.resolve({ data: [], error: null }),

    businessIds.length
      ? supabase
          .from("payroll_runs")
          .select("*")
          .in("business_id", businessIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),

    businessIds.length
      ? supabase
          .from("stores")
          .select(
            "*,categories:store_categories(*),products:store_products(*)"
          )
          .in("business_id", businessIds)
      : Promise.resolve({ data: [], error: null }),

    businessIds.length
      ? supabase
          .from("business_inventory")
          .select(
            "id,community_id,business_id,product_id,item_name,quantity,reserved_quantity,average_cost,metadata,status,created_at,updated_at,product:store_products!business_inventory_product_id_fkey(id,sku,name,category,price,product_type)"
          )
          .in("business_id", businessIds)
          .order("updated_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),

    businessIds.length
      ? supabase
          .from("business_expenses")
          .select("*")
          .in("business_id", businessIds)
          .order("created_at", { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const pageErrors = [
    ownedError?.message,
    memberRowsError?.message,
    employedError?.message,
    accountsResult.error?.message,
    membersResult.error?.message,
    transactionsResult.error?.message,
    payrollResult.error?.message,
    storesResult.error?.message,
    inventoryResult.error?.message,
    expensesResult.error?.message,
  ].filter(Boolean);

  const accounts = accountsResult.data ?? [];
  const members = membersResult.data ?? [];
  const transactions = transactionsResult.data ?? [];
  const payroll = payrollResult.data ?? [];
  const stores = storesResult.data ?? [];
  const inventory = inventoryResult.data ?? [];
  const expenses = expensesResult.data ?? [];

  const hydratedBusinesses = businesses.map((business) => ({
    ...business,
    bank_account:
      accounts.find(
        (account: any) =>
          account.id === business.business_bank_account_id
      ) ?? null,
    members: members.filter(
      (member: any) => member.business_id === business.id
    ),
    transactions: transactions.filter(
      (transaction: any) =>
        transaction.account_id === business.business_bank_account_id
    ),
    payrollRuns: payroll.filter(
      (run: any) => run.business_id === business.id
    ),
    store:
      stores.find(
        (store: any) => store.business_id === business.id
      ) ?? null,
    inventory: inventory.filter(
      (item: any) => item.business_id === business.id
    ),
    expenses: expenses.filter(
      (expense: any) => expense.business_id === business.id
    ),
  }));

  return (
    <AppShell
      title="Businesses"
      subtitle={`${character.first_name} ${character.last_name} · ${character.state_id}`}
    >
      <BusinessesClient
        character={character}
        businesses={hydratedBusinesses}
        loadError={pageErrors.join(" | ")}
      />
    </AppShell>
  );
}
