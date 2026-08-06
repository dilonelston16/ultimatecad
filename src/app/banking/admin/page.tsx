import { AppShell } from "@/components/app-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import BankingAdminClient from "./banking-admin-client";

export default async function BankingAdminPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/banking/admin");

  const { data: membership } = await supabase
    .from("community_memberships")
    .select("community_id,is_owner")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at")
    .limit(1)
    .maybeSingle();

  if (!membership) redirect("/onboarding");

  let allowed = membership.is_owner === true;
  if (!allowed) {
    const { data } = await supabase.rpc("has_permission", {
      target_community_id: membership.community_id,
      requested_permission: "banking.manage",
    });
    allowed = data === true;
  }
  if (!allowed) redirect("/banking?error=banking_admin_required");

  const [{ data: accounts }, { data: transactions }, { data: holds }] = await Promise.all([
    supabase
      .from("bank_accounts")
      .select("*,character:characters(id,first_name,last_name,state_id),business:businesses(id,name,business_number)")
      .eq("community_id", membership.community_id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("bank_transactions")
      .select("*")
      .eq("community_id", membership.community_id)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("bank_account_holds")
      .select("*")
      .eq("community_id", membership.community_id)
      .order("placed_at", { ascending: false }),
  ]);

  return (
    <AppShell title="Banking Administration" subtitle="Monitor accounts, adjust balances, freeze access, place holds, and seize funds.">
      <BankingAdminClient accounts={accounts ?? []} transactions={transactions ?? []} holds={holds ?? []} />
    </AppShell>
  );
}
