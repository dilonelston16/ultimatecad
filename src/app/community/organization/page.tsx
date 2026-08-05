import { AppShell } from "@/components/app-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import OrganizationBuilder from "./organization-builder";

export default async function OrganizationPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/community/organization");

  const { data: membership } = await supabase
    .from("community_memberships")
    .select("community_id,is_owner,community:communities(name)")
    .eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle();
  if (!membership) redirect("/onboarding");
  if (!membership.is_owner) redirect("/dashboard");

  const { data: nodes } = await supabase
    .from("organization_nodes")
    .select("id,parent_id,node_type,name,slug,description,color,abbreviation,callsign_prefix,logo_url,sort_order,is_archived")
    .eq("community_id", membership.community_id)
    .order("sort_order", { ascending: true });

  const communityRaw = membership.community;
  const community = (Array.isArray(communityRaw) ? communityRaw[0] : communityRaw) as { name: string } | null;

  return (
    <AppShell title="Organization Builder" subtitle={`${community?.name ?? "Community"} · Agency → Department → Division → Subdivision`}>
      <OrganizationBuilder initialNodes={nodes ?? []} communityId={membership.community_id} />
    </AppShell>
  );
}
