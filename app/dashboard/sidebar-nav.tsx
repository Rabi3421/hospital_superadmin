"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  CalendarDays,
  CreditCard,
  FileText,
  Images,
  LayoutDashboard,
  LifeBuoy,
  Handshake,
  Settings,
  UsersRound,
  WalletCards,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  section: string;
  exact?: boolean;
  activePrefix?: string;
  excludedPrefix?: string;
};

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, section: "Main Menu", exact: true },
  { href: "/dashboard/hospitals", label: "Hospitals", icon: Building2, section: "Main Menu" },
  { href: "/dashboard/hospital-users", label: "Hospital Users", icon: UsersRound, section: "Main Menu" },
  { href: "/dashboard/referral-partners", label: "Referral Partners", icon: Handshake, section: "Main Menu" },
  { href: "/dashboard/subscriptions", label: "Subscriptions", icon: CalendarDays, section: "Operations" },
  { href: "/dashboard/collections", label: "Collections", icon: WalletCards, section: "Operations" },
  { href: "/dashboard/platform-payments", label: "Platform Payments", icon: CreditCard, section: "Operations" },
  {
    href: "/dashboard/public-content/departments",
    label: "Public Content",
    icon: Images,
    section: "Operations",
    activePrefix: "/dashboard/public-content",
    excludedPrefix: "/dashboard/public-content/notices",
  },
  { href: "/dashboard/public-content/notices", label: "Notices", icon: FileText, section: "Operations", exact: true },
  { href: "/dashboard/help-center", label: "Help Center", icon: LifeBuoy, section: "Settings" },
  { href: "/dashboard/settings", label: "Settings", icon: Settings, section: "Settings" },
];

export default function SidebarNav({ onNavigate }: { onNavigate?: () => void } = {}) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 pb-24 pt-3">
      {["Main Menu", "Operations", "Settings"].map((section) => (
        <div key={section}>
          <p className="px-4 pb-1 pt-4 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
            {section}
          </p>
          <div className="space-y-0.5">
            {navItems
              .filter((item) => item.section === section)
              .map((item) => {
                const Icon = item.icon;
                const matchPath = item.activePrefix ?? item.href;
                const active =
                  !(item.excludedPrefix && pathname.startsWith(item.excludedPrefix)) &&
                  (item.exact ? pathname === matchPath : pathname === matchPath || pathname.startsWith(`${matchPath}/`));

                return (
                  <Link
                    key={`${section}-${item.label}`}
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={`flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                      active
                        ? "bg-[#edf8f3] text-[#278b7c]"
                        : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <Icon size={18} className="shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
          </div>
        </div>
      ))}
    </nav>
  );
}
