"use client";

import {
  BadgeDollarSign,
  Banknote,
  BriefcaseBusiness,
  Building2,
  Car,
  ChevronDown,
  CircleUserRound,
  Gavel,
  Home,
  Landmark,
  LayoutDashboard,
  LogOut,
  Package,
  Scale,
  Settings,
  Shield,
  ShoppingBag,
  Store,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type AppShellProps = {
  children?: ReactNode;
  title?: string;
  subtitle?: string;
  section?: string;
  activeItem?: string;
};

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  status?: "coming-soon";
};

const globalItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Civilian", href: "/civilian", icon: CircleUserRound, status: "coming-soon" },
  { label: "Banking", href: "/banking", icon: Landmark, status: "coming-soon" },
  { label: "Economy", href: "/economy", icon: BadgeDollarSign, status: "coming-soon" },
  { label: "Businesses", href: "/businesses", icon: BriefcaseBusiness, status: "coming-soon" },
  { label: "Stores", href: "/stores", icon: Store, status: "coming-soon" },
  { label: "Vehicles", href: "/vehicles", icon: Car, status: "coming-soon" },
  { label: "Properties", href: "/properties", icon: Home, status: "coming-soon" },
  { label: "Licenses", href: "/licenses", icon: Shield, status: "coming-soon" },
  { label: "Weapons", href: "/weapons", icon: Package, status: "coming-soon" },
  { label: "Insurance", href: "/insurance", icon: Banknote, status: "coming-soon" },
];

const departmentItems: NavItem[] = [
  { label: "LEO Dashboard", href: "/agencies/law-enforcement", icon: Shield },
  { label: "Reports", href: "/agencies/law-enforcement/reports", icon: Gavel, status: "coming-soon" },
  { label: "Penal Codes", href: "/agencies/law-enforcement/penal-codes", icon: Scale, status: "coming-soon" },
];

const communityItems: NavItem[] = [
  { label: "Organization Builder", href: "/community/organization", icon: Building2 },
  { label: "Members", href: "/community/members", icon: Users, status: "coming-soon" },
  { label: "Community Settings", href: "/community/settings", icon: Settings, status: "coming-soon" },
];

function NavLink({
  item,
  active,
}: {
  item: NavItem;
  active: boolean;
}) {
  const Icon = item.icon;

  if (item.status === "coming-soon") {
    return (
      <div className="nav-item nav-item-disabled" title="Coming in a future milestone">
        <Icon size={17} strokeWidth={1.9} />
        <span>{item.label}</span>
        <small>Soon</small>
      </div>
    );
  }

  return (
    <Link href={item.href} className={`nav-item${active ? " active" : ""}`}>
      <Icon size={17} strokeWidth={1.9} />
      <span>{item.label}</span>
    </Link>
  );
}

export function AppShell({
  children,
  title,
  subtitle,
}: AppShellProps) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/dashboard"
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Link href="/dashboard" className="brand">
            <span className="brand-mark">U</span>
            <span>
              UltimateCAD
              <small>Community operating system</small>
            </span>
          </Link>
        </div>

        <div className="sidebar-section">
          <span className="section-label">Main</span>
          {globalItems.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} />
          ))}
        </div>

        <div className="sidebar-section">
          <span className="section-label">My Department</span>
          <button className="department-switch" type="button">
            <span>
              <Shield size={17} />
              Law Enforcement
            </span>
            <ChevronDown size={15} />
          </button>

          {departmentItems.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} />
          ))}
        </div>

        <div className="sidebar-section">
          <span className="section-label">Community</span>
          {communityItems.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} />
          ))}
        </div>

        <div className="sidebar-bottom">
          <form action="/auth/signout" method="post">
            <button className="nav-item sidebar-signout" type="submit">
              <LogOut size={17} />
              <span>Sign out</span>
            </button>
          </form>
        </div>
      </aside>

      <main className="workspace">
        {(title || subtitle) && (
          <header className="shell-page-header">
            <div>
              {title ? <h1>{title}</h1> : null}
              {subtitle ? <p>{subtitle}</p> : null}
            </div>
          </header>
        )}

        {children}
      </main>
    </div>
  );
}

export default AppShell;
