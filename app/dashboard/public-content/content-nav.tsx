"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  ["Departments", "/dashboard/public-content/departments"],
  ["Doctors", "/dashboard/public-content/doctors"],
  ["Notices", "/dashboard/public-content/notices"],
  ["Gallery", "/dashboard/public-content/gallery"],
  ["Enquiries", "/dashboard/public-content/enquiries"],
  ["Appointment Requests", "/dashboard/public-content/appointment-requests"],
];

export default function ContentNav() {
  const pathname = usePathname();
  return (
    <div className="flex gap-2 overflow-x-auto border-b border-[#e2eae6]">
      {links.map(([label, href]) => (
        <Link key={href} href={href} className={`min-w-max border-b-2 px-3 py-3 text-sm font-bold ${pathname === href ? "border-[#278b7c] text-[#278b7c]" : "border-transparent text-[#687370] hover:text-[#278b7c]"}`}>
          {label}
        </Link>
      ))}
    </div>
  );
}
