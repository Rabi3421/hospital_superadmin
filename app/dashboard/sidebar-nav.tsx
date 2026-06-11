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
  Settings,
  UsersRound,
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
  { href: "/dashboard/subscriptions", label: "Subscriptions", icon: CalendarDays, section: "Operations" },
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

export default function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-2 overflow-x-auto px-3 pb-4 lg:block lg:flex-1 lg:overflow-y-auto lg:overflow-x-hidden lg:px-5">
      {["Main Menu", "Operations", "Settings"].map((section) => (
        <div key={section} className="lg:mb-7">
          <p className="hidden px-3 pb-3 text-[12px] font-medium text-[#9aa5a1] lg:block">{section}</p>
          <div className="flex gap-2 lg:block lg:space-y-1">
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
                    aria-current={active ? "page" : undefined}
                    className={`flex min-w-max items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold transition ${
                      active
                        ? "border-r-2 border-[#278b7c] bg-[#edf8f3] text-[#1f7b6f]"
                        : "text-[#687370] hover:bg-[#f3f7f5] hover:text-[#1f7b6f]"
                    }`}
                  >
                    <Icon size={17} />
                    {item.label}
                  </Link>
                );
              })}
          </div>
        </div>
      ))}
    </nav>
  );
}
