import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Bell,
  Moon,
  Search,
  ShieldPlus,
} from "lucide-react";
import { getSuperAdminFromCookies } from "@/lib/superadmin-auth";
import LogoutButton from "./logout-button";
import MobileNav from "./mobile-nav";
import SidebarNav from "./sidebar-nav";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const admin = await getSuperAdminFromCookies();
  if (!admin) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f6f8f7] text-[#151918] lg:flex lg:h-screen lg:overflow-hidden">
      {/* Sidebar — desktop only fixed column */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-[260px] lg:flex-col lg:border-r lg:border-slate-200 lg:bg-white">
        {/* Brand */}
        <div className="flex h-[72px] items-center border-b border-slate-200 px-5">
          <Link href="/dashboard" className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#278b7c] text-white shadow-sm">
              <ShieldPlus size={20} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-bold leading-tight text-slate-900">WeCare</span>
              <span className="mt-0.5 block truncate text-[11px] font-medium text-slate-400">Medical Admin Dashboard</span>
            </span>
          </Link>
        </div>

        {/* Vertical nav */}
        <SidebarNav />

        {/* Admin info + dark mode at bottom */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-slate-200 bg-white px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#d7ece5] text-sm font-bold text-[#278b7c]">
              {admin.name?.charAt(0) ?? "A"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">{admin.name}</p>
              <p className="truncate text-[11px] font-medium text-slate-400">{admin.email}</p>
            </div>
            <LogoutButton />
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex min-h-screen flex-1 flex-col lg:h-screen lg:min-h-0 lg:overflow-hidden lg:pl-[260px]">
        {/* Mobile hamburger nav — hidden on desktop */}
        <MobileNav
          adminName={admin.name ?? "Admin"}
          adminInitial={admin.name?.charAt(0) ?? "A"}
          adminEmail={admin.email ?? ""}
        />

        {/* Desktop top header */}
        <header className="hidden h-20 shrink-0 items-center justify-between border-b border-[#e4ece8] bg-white px-9 lg:flex">
          <div className="flex h-12 w-full max-w-xl items-center gap-3 rounded-md border border-[#e4ece8] bg-[#f8fbfa] px-4 text-[#8a9591]">
            <Search size={18} />
            <span className="text-sm font-medium">Search anything here</span>
          </div>
          <div className="flex items-center gap-5">
            <button className="flex h-10 w-10 items-center justify-center rounded-md text-[#151918] hover:bg-[#f3f7f5]" type="button">
              <Bell size={20} />
            </button>
            <div className="h-8 w-px bg-[#e2e8e5]" />
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#d7ece5] text-sm font-bold text-[#1f7b6f]">
                {admin.name?.charAt(0) ?? "A"}
              </div>
              <div>
                <p className="text-sm font-bold text-[#151918]">{admin.name}</p>
                <p className="text-xs font-medium text-[#8a9591]">{admin.email}</p>
              </div>
            </div>
            <LogoutButton />
          </div>
        </header>
        <main className="flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:min-h-0 lg:overflow-y-auto lg:px-9 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
