"use client";

import {
  BadgeCheck,
  BadgeDollarSign,
  Banknote,
  BriefcaseBusiness,
  Building2,
  Car,
  ChevronDown,
  CircleUserRound,
  Gavel,
  Home,
  KeyRound,
  Landmark,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Menu,
  Package,
  Scale,
  Settings,
  Shield,
  Store,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import CharacterSwitcher from "@/components/character-switcher";
import styles from "./app-shell.module.css";

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
  comingSoon?: boolean;
};

const sharedItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Civilian", href: "/civilian", icon: CircleUserRound },
  { label: "Banking", href: "/banking", icon: Landmark },
  { label: "Economy", href: "/economy", icon: BadgeDollarSign },
  { label: "Businesses", href: "/businesses", icon: BriefcaseBusiness },
  { label: "Stores", href: "/stores", icon: Store },
  { label: "Vehicles", href: "/vehicles", icon: Car },
  { label: "Properties", href: "/properties", icon: Home, comingSoon: true },
  { label: "Licenses", href: "/licenses", icon: Shield },
  { label: "Weapons", href: "/weapons", icon: Package, comingSoon: true },
  { label: "Insurance", href: "/insurance", icon: Banknote },
];

const departmentItems: NavItem[] = [
  { label: "LEO Dashboard", href: "/agencies/law-enforcement", icon: Shield },
  { label: "Reports", href: "/agencies/law-enforcement/reports", icon: Gavel, comingSoon: true },
  { label: "Penal Codes", href: "/agencies/law-enforcement/penal-codes", icon: Scale, comingSoon: true },
  { label: "DMV Administration", href: "/dmv", icon: BadgeCheck },
];

const communityItems: NavItem[] = [
  { label: "Organization Builder", href: "/community/organization", icon: Building2 },
  { label: "Roles & Permissions", href: "/community/permissions", icon: LockKeyhole },
  { label: "Department Access", href: "/community/access", icon: KeyRound },
  { label: "Members", href: "/community/members", icon: Users, comingSoon: true },
  { label: "Community Settings", href: "/community/settings", icon: Settings, comingSoon: true },
];

function NavLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate: () => void;
}) {
  const Icon = item.icon;

  if (item.comingSoon) {
    return (
      <div className={`${styles.navItem} ${styles.disabled}`}>
        <Icon size={18} strokeWidth={1.9} />
        <span>{item.label}</span>
        <small>Soon</small>
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={`${styles.navItem} ${active ? styles.active : ""}`}
    >
      <Icon size={18} strokeWidth={1.9} />
      <span>{item.label}</span>
    </Link>
  );
}

export function AppShell({ children, title, subtitle }: AppShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.documentElement.style.overflow = mobileOpen ? "hidden" : "";
    document.body.style.overflow = mobileOpen ? "hidden" : "";

    return () => {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const isActive = (href: string) =>
    href === "/dashboard"
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);

  const close = () => setMobileOpen(false);

  return (
    <div className={styles.shell}>
      <header className={styles.mobileTopbar}>
        <button
          type="button"
          className={styles.menuButton}
          aria-label="Open navigation"
          onClick={() => setMobileOpen(true)}
        >
          <Menu size={22} />
        </button>
        <Link href="/dashboard" className={styles.mobileBrand}>
          <span className={styles.brandMark}>U</span>
          <span>UltimateCAD</span>
        </Link>
      </header>

      {mobileOpen && (
        <button
          type="button"
          className={styles.backdrop}
          aria-label="Close navigation"
          onClick={close}
        />
      )}

      <aside className={`${styles.sidebar} ${mobileOpen ? styles.open : ""}`}>
        <div className={styles.sidebarHeader}>
          <Link href="/dashboard" onClick={close} className={styles.brand}>
            <span className={styles.brandMark}>U</span>
            <span>
              <strong>UltimateCAD</strong>
              <small>Community operating system</small>
            </span>
          </Link>

          <button
            type="button"
            className={styles.closeButton}
            aria-label="Close navigation"
            onClick={close}
          >
            <X size={21} />
          </button>
        </div>

        <div className={styles.scrollArea}>
          <div className={styles.switcherWrap}>
            <CharacterSwitcher />
          </div>

          <nav className={styles.section}>
            <span className={styles.sectionLabel}>Main</span>
            {sharedItems.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                active={isActive(item.href)}
                onNavigate={close}
              />
            ))}
          </nav>

          <nav className={styles.section}>
            <span className={styles.sectionLabel}>My Department</span>
            <button className={styles.departmentSwitch} type="button">
              <span>
                <Shield size={18} />
                Law Enforcement
              </span>
              <ChevronDown size={16} />
            </button>

            {departmentItems.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                active={isActive(item.href)}
                onNavigate={close}
              />
            ))}
          </nav>

          <nav className={styles.section}>
            <span className={styles.sectionLabel}>Community</span>
            {communityItems.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                active={isActive(item.href)}
                onNavigate={close}
              />
            ))}
          </nav>
        </div>

        <div className={styles.sidebarFooter}>
          <form action="/auth/signout" method="post">
            <button className={styles.signOut} type="submit">
              <LogOut size={18} />
              <span>Sign out</span>
            </button>
          </form>
        </div>
      </aside>

      <main className={styles.workspace}>
        {(title || subtitle) && (
          <header className={styles.pageHeader}>
            {title ? <h1>{title}</h1> : null}
            {subtitle ? <p>{subtitle}</p> : null}
          </header>
        )}
        <div className={styles.content}>{children}</div>
      </main>
    </div>
  );
}

export default AppShell;
