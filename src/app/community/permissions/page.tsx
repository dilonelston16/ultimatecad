import { AppShell } from "@/components/app-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PermissionsManager from "./permissions-manager";

export default async function PermissionsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/community/permissions");

  const { data: membership } = await supabase
    .from("community_memberships")
    .select("id,community_id,is_owner,community:communities(name,prefix)")
    .eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle();
  if (!membership) redirect("/onboarding");

  const { data: allowed } = await supabase.rpc("has_permission", { target_community_id: membership.community_id, requested_permission: "permissions.manage" });
  if (!membership.is_owner && !allowed) redirect("/dashboard");

  const [{ data: roles }, { data: permissions }, { data: rolePermissions }, { data: nodes }, { data: keys }] = await Promise.all([
    supabase.from("roles").select("id,name,description,color,rank_level,is_system,is_archived,discord_role_id,organization_node_id").eq("community_id",membership.community_id).order("rank_level",{ascending:false}),
    supabase.from("permissions").select("key,name,description,category").order("category").order("name"),
    supabase.from("role_permissions").select("role_id,permission_key,allowed"),
    supabase.from("organization_nodes").select("id,name,node_type,parent_id").eq("community_id",membership.community_id).eq("is_archived",false).order("sort_order"),
    supabase.from("permission_keys").select("id,label,code,max_uses,used_count,expires_at,active,role_id,organization_node_id,created_at").eq("community_id",membership.community_id).order("created_at",{ascending:false}),
  ]);

  const raw = membership.community;
  const community = (Array.isArray(raw) ? raw[0] : raw) as {name:string;prefix:string}|null;

  return (
    <AppShell title="Roles & Permissions" subtitle={`${community?.name ?? "Community"} · Access control and permission keys`}>
      <PermissionsManager communityId={membership.community_id} communityPrefix={community?.prefix ?? "CAD"} initialRoles={roles ?? []} permissions={permissions ?? []} initialRolePermissions={rolePermissions ?? []} nodes={nodes ?? []} initialKeys={keys ?? []} />
    </AppShell>
  );
}
