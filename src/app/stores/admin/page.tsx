import { AppShell } from "@/components/app-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import StoreCatalogAdminClient from "./store-catalog-admin-client";

export default async function StoreCatalogAdminPage() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/stores/admin");

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
      requested_permission: "stores.manage_catalog",
    });

    allowed = data === true;
  }

  if (!allowed) redirect("/stores?error=store_catalog_access_required");

  const { data: stores } = await supabase
    .from("stores")
    .select(
      "id,name,store_type,category_group,business_id,products:store_products(*)"
    )
    .eq("community_id", membership.community_id)
    .order("store_type")
    .order("name");

  return (
    <AppShell
      title="Store Catalogue Administration"
      subtitle="Create, edit, restrict, disable, delete, restock, and bulk-import products."
    >
      <StoreCatalogAdminClient
        communityId={membership.community_id}
        stores={stores ?? []}
      />
    </AppShell>
  );
}
