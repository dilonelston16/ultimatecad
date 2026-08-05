"use client";

import type { ReactNode } from "react";
import Link from "next/link";

type AppShellProps = {
  children?: ReactNode;
  title?: string;
  subtitle?: string;
  section?: string;
  activeItem?: string;
  [key: string]: unknown;
};

const navigation = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Organization Builder", href: "/community/organization" },
  { label: "Civilian", href: "/civilian" },
  { label: "Banking", href: "/banking" },
  { label: "Economy", href: "/economy" },
  { label: "Businesses", href: "/businesses" },
  { label: "Vehicles", href: "/vehicles" },
  { label: "Licenses", href: "/licenses" },
  { label: "Weapons", href: "/weapons" },
  { label: "Law Enforcement", href: "/agencies/law-enforcement" },
];

export function AppShell({
  children,
  title = "UltimateCAD",
  subtitle,
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[260px_1fr]">
        <aside className="border-r border-slate-800 bg-slate-950/95 p-5">
          <Link href="/dashboard" className="mb-8 block">
            <div className="text-xl font-bold tracking-tight">UltimateCAD</div>
            <div className="text-xs text-slate-500">
              Community management platform
            </div>
          </Link>

          <nav className="space-y-1">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-900 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="min-w-0">
          <header className="border-b border-slate-800 bg-slate-950/80 px-6 py-5 backdrop-blur">
            <h1 className="text-2xl font-semibold">{title}</h1>
            {subtitle ? (
              <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
            ) : null}
          </header>

          <div className="p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

export default AppShell;
