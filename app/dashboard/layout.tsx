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
import SidebarNav from "./sidebar-nav";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const admin = await getSuperAdminFromCookies();
  if (!admin) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-[#f6f8f7] text-[#151918] lg:flex lg:h-screen lg:overflow-hidden">
      <aside className="border-b border-[#dfe8e4] bg-white lg:fixed lg:inset-y-0 lg:flex lg:w-[248px] lg:flex-col lg:border-b-0 lg:border-r">
        <div className="flex h-20 items-center justify-between px-6">
          <Link href="/dashboard" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#278b7c] text-white shadow-sm">
              <ShieldPlus size={22} />
            </span>
            <span>
              <span className="block text-xl font-bold leading-5 text-[#151918]">WeCare</span>
              <span className="mt-1 block text-[11px] font-medium text-[#7b8783]">Medical Admin Dashboard</span>
            </span>
          </Link>
          <div className="lg:hidden">
            <LogoutButton />
          </div>
        </div>
        <SidebarNav />
        <div className="hidden px-6 pb-7 lg:absolute lg:bottom-0 lg:left-0 lg:right-0 lg:block">
          <div className="flex items-center justify-between rounded-lg bg-[#f5f7f6] px-3 py-3">
            <span className="flex items-center gap-2 text-sm font-semibold text-[#687370]">
              <Moon size={17} />
              Dark mode
            </span>
            <span className="flex h-7 w-12 items-center rounded-full bg-[#c9d0ce] p-1">
              <span className="h-5 w-5 rounded-full bg-white shadow-sm" />
            </span>
          </div>
        </div>
      </aside>
      <div className="flex min-h-screen flex-1 flex-col lg:h-screen lg:min-h-0 lg:overflow-hidden lg:pl-[248px]">
        <header className="hidden h-20 shrink-0 items-center justify-between border-b border-[#e4ece8] bg-white px-9 lg:flex">
          <div className="flex h-12 w-full max-w-xl items-center gap-3 rounded-md border border-transparent bg-white text-[#8a9591]">
            <Search size={21} />
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
        <main className="flex-1 px-4 py-6 sm:px-6 lg:min-h-0 lg:overflow-y-auto lg:px-9 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
