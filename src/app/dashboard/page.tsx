import { AppShell } from "@/components/app-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ArrowRight, Bell, Building2, Clock3, Copy, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login?next=/dashboard");

  const { data: membership } = await supabase
    .from("community_memberships")
    .select("id,is_owner,community:communities(id,name,prefix,join_code)")
    .eq("user_id", userData.user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (!membership) redirect("/onboarding");

  const communityRaw = membership.community;
  const community = (Array.isArray(communityRaw) ? communityRaw[0] : communityRaw) as { id: string; name: string; prefix: string; join_code: string } | null;
  if (!community) redirect("/onboarding");

  const [{ count: memberCount }, { count: departmentCount }] = await Promise.all([
    supabase.from("community_memberships").select("id", { count: "exact", head: true }).eq("community_id", community.id).eq("status", "active"),
    supabase.from("organization_nodes").select("id", { count: "exact", head: true }).eq("community_id", community.id).eq("node_type", "department"),
  ]);

  const displayName = userData.user.user_metadata?.full_name ?? userData.user.user_metadata?.name ?? userData.user.user_metadata?.user_name ?? "CAD Member";
  const initials = String(displayName).split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();

  return (
    <AppShell>
      <header className="topbar">
        <div><div className="eyebrow">{community.name}</div><h1>Community Dashboard</h1></div>
        <div className="top-actions">
          <button className="icon-button" aria-label="Notifications"><Bell size={19}/></button>
          <div className="profile-pill"><div className="avatar">{initials}</div><span><b>{displayName}</b><small>{membership.is_owner ? "Founder" : "Member"}</small></span></div>
          <form action="/auth/signout" method="post"><button className="button ghost" type="submit">Sign out</button></form>
        </div>
      </header>

      <section className="page-content">
        <div className="stats-grid four">
          <div className="stat-card"><Users/><span>Members</span><strong>{memberCount ?? 1}</strong><small>Active community memberships</small></div>
          <div className="stat-card"><Building2/><span>Departments</span><strong>{departmentCount ?? 0}</strong><small>Configured organization nodes</small></div>
          <div className="stat-card"><Clock3/><span>Clocked In</span><strong>0</strong><small>Shift system arrives in LEO milestone</small></div>
          <div className="stat-card"><Bell/><span>Open Alerts</span><strong>0</strong><small>Panic and dispatch alerts pending</small></div>
        </div>

        <div className="content-grid two">
          <section className="panel">
            <div className="panel-title"><div><span className="eyebrow">Authorized access</span><h2>My workspaces</h2></div></div>
            <Link className="workspace-link" href="/community/organization"><span><span className="workspace-icon">ORG</span>Organization Builder</span><ArrowRight size={18}/></Link>
            <Link className="workspace-link" href="/agencies/law-enforcement"><span><span className="workspace-icon">LEO</span>Law Enforcement — Initial Preview</span><ArrowRight size={18}/></Link>
          </section>

          <section className="panel">
            <div className="panel-title"><div><span className="eyebrow">Community access</span><h2>Join code</h2></div></div>
            <div className="join-code-card"><span>Share with approved members</span><strong>{community.join_code}</strong><small><Copy size={14}/> Department permission keys will remain separate.</small></div>
          </section>
        </div>
      </section>
    </AppShell>
  );
}
