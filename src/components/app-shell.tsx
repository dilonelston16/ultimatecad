"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, BadgeDollarSign, Banknote, BriefcaseBusiness, Building2, Car, ChevronDown, CircleUserRound, Gavel, Home, Landmark, Radio, Scale, Search, Settings, Shield, ShoppingBag, Siren, Store, Truck, Users, WalletCards } from "lucide-react";

const shared = [
  ["Dashboard", "/dashboard", Home], ["Civilian", "#", CircleUserRound], ["Banking", "#", Banknote], ["Economy", "#", BadgeDollarSign], ["Businesses", "#", BriefcaseBusiness], ["Stores", "#", Store], ["Vehicles", "#", Car], ["Properties", "#", Building2], ["Licenses", "#", WalletCards], ["Weapons", "#", Shield], ["Insurance", "#", Landmark],
] as const;

const leo = [
  ["LEO Dashboard", "/agencies/law-enforcement", Home], ["Active Calls", "#", Radio], ["Unit Status", "#", Users], ["Reports", "#", Scale], ["Citations", "#", Gavel], ["Arrests", "#", Siren], ["BOLOs", "#", AlertTriangle], ["Warrants", "#", Search], ["Towing", "#", Truck], ["Penal Codes", "#", Scale],
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand sidebar-brand"><span className="brand-mark">U</span><span>UltimateCAD</span></div>
      <div className="sidebar-section"><span className="section-label">GENERAL ACCESS</span>{shared.map(([label, href, Icon]) => <Link key={label} className={`nav-item ${pathname === href ? "active" : ""}`} href={href}><Icon size={18}/><span>{label}</span></Link>)}</div>
      <div className="sidebar-section"><span className="section-label">MY DEPARTMENT</span><button className="department-switch"><span><Shield size={17}/> LSPD</span><ChevronDown size={16}/></button>{leo.map(([label, href, Icon]) => <Link key={label} className={`nav-item ${pathname === href ? "active" : ""}`} href={href}><Icon size={18}/><span>{label}</span></Link>)}</div>
      <div className="sidebar-bottom"><Link className="nav-item" href="#"><Settings size={18}/>Settings</Link><Link className="nav-item" href="#"><ShoppingBag size={18}/>Marketplace</Link></div>
    </aside>
    <main className="workspace">{children}</main>
  </div>
}
