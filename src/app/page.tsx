import Link from "next/link";
import { BadgeCheck, Building2, RadioTower, ShieldCheck } from "lucide-react";

export default function Home() {
  return (
    <main className="landing-shell">
      <nav className="landing-nav">
        <div className="brand"><span className="brand-mark">U</span><span>UltimateCAD</span></div>
        <div className="nav-actions"><Link className="button ghost" href="/login">Sign in</Link><Link className="button" href="/onboarding">Create community</Link></div>
      </nav>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">Built for Xbox & PlayStation roleplay</div>
          <h1>The complete operating system for your GTA RP community.</h1>
          <p>Run civilians, law enforcement, dispatch, courts, towing, banking, businesses, licensing, economy and Discord access from one realistic multi-community platform.</p>
          <div className="hero-actions"><Link className="button large" href="/onboarding">Start building</Link><Link className="button ghost large" href="/agencies/law-enforcement">Preview LEO dashboard</Link></div>
          <div className="trust-row"><span><ShieldCheck size={18}/> Tenant-isolated</span><span><BadgeCheck size={18}/> Permission-driven</span><span><RadioTower size={18}/> Discord-ready</span></div>
        </div>
        <div className="hero-panel">
          <div className="hero-panel-head"><Building2 size={22}/><strong>Community structure</strong></div>
          <div className="tree"><div>Ultimate World Roleplay</div><div className="tree-level">Law Enforcement Agency</div><div className="tree-level two">LSPD Department</div><div className="tree-level three">Patrol Division</div><div className="tree-level four">Traffic Subdivision</div></div>
          <div className="mini-grid"><div><b>4</b><span>Console platforms</span></div><div><b>All</b><span>Core modules</span></div><div><b>300+</b><span>Permission targets</span></div><div><b>24/7</b><span>CAD access</span></div></div>
        </div>
      </section>
    </main>
  );
}
