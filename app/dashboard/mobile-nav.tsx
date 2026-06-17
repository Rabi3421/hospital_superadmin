"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, ShieldPlus, X } from "lucide-react";
import LogoutButton from "./logout-button";
import SidebarNav from "./sidebar-nav";

type Props = {
  adminName: string;
  adminInitial: string;
  adminEmail: string;
};

export default function MobileNav({ adminName, adminInitial, adminEmail }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      {/* Mobile top bar */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-[#dfe8e4] bg-white px-4 sm:px-5 lg:hidden">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-md text-[#394340] hover:bg-[#f3f7f5]"
            aria-label="Open navigation"
          >
            <Menu size={22} />
          </button>
          <Link href="/dashboard" className="flex items-center gap-2" onClick={() => setOpen(false)}>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#278b7c] text-white">
              <ShieldPlus size={17} />
            </span>
            <span className="block text-[15px] font-bold text-[#151918]">WeCare</span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#d7ece5] text-xs font-bold text-[#1f7b6f]">
            {adminInitial}
          </div>
          <LogoutButton />
        </div>
      </div>

      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 lg:hidden ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Slide-in drawer */}
      <aside
        aria-label="Mobile navigation"
        className={`fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col bg-white shadow-2xl transition-transform duration-300 ease-in-out lg:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Drawer header */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-[#dfe8e4] px-4">
          <Link href="/dashboard" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#278b7c] text-white">
              <ShieldPlus size={17} />
            </span>
            <span>
              <span className="block text-[15px] font-bold leading-5 text-[#151918]">WeCare</span>
              <span className="block text-[10px] font-medium text-[#7b8783]">Medical Admin Dashboard</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#687370] hover:bg-[#f3f7f5]"
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav links — closes drawer on navigate */}
        <SidebarNav onNavigate={() => setOpen(false)} />

        {/* User footer */}
        <div className="shrink-0 border-t border-[#dfe8e4] px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#d7ece5] text-sm font-bold text-[#1f7b6f]">
              {adminInitial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-[#151918]">{adminName}</p>
              <p className="truncate text-[11px] font-medium text-[#8a9591]">{adminEmail}</p>
            </div>
            <LogoutButton />
          </div>
        </div>
      </aside>
    </>
  );
}
