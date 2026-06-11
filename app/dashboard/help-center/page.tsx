import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, Building2, CreditCard, KeyRound, UsersRound } from "lucide-react";
import { getSuperAdminFromCookies } from "@/lib/superadmin-auth";
import { PageHeader } from "../components/dashboard-ui";

export default async function HelpCenterPage() {
  const admin = await getSuperAdminFromCookies();
  if (!admin) redirect("/login");

  const guides = [
    { icon: Building2, title: "Hospital onboarding", description: "Create a tenant, review its profile, then activate access and public website status.", href: "/dashboard/hospitals/new" },
    { icon: UsersRound, title: "Hospital users", description: "Create owner, admin, and role accounts scoped to one hospital.", href: "/dashboard/hospital-users" },
    { icon: CreditCard, title: "Subscriptions and payments", description: "Manage plans, trials, overdue states, and platform subscription payments.", href: "/dashboard/subscriptions" },
    { icon: KeyRound, title: "Hospital authentication", description: "Review the Phase 3 hospital login, session, metadata, and overview API flow.", href: "/dashboard/settings" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Help Center" description="Short guides for the central superadmin workflows." />
      <section className="grid gap-4 md:grid-cols-2">
        {guides.map((guide) => {
          const Icon = guide.icon;
          return (
            <Link key={guide.title} href={guide.href} className="group rounded-lg border border-[#e2eae6] bg-white p-5 shadow-[0_12px_32px_rgba(32,45,39,0.04)] transition hover:border-[#b9d7ce]">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#edf8f3] text-[#278b7c]"><Icon size={19} /></span>
              <h2 className="mt-4 text-base font-bold text-[#151918] group-hover:text-[#278b7c]">{guide.title}</h2>
              <p className="mt-2 text-sm font-medium leading-6 text-[#7a8581]">{guide.description}</p>
            </Link>
          );
        })}
      </section>
      <section className="rounded-lg border border-[#e2eae6] bg-white p-5">
        <div className="flex items-center gap-3">
          <BookOpen size={19} className="text-[#278b7c]" />
          <h2 className="text-base font-bold text-[#151918]">Developer documentation</h2>
        </div>
        <p className="mt-2 text-sm font-medium text-[#7a8581]">Hospital authentication test commands are available in <code className="rounded bg-[#f3f7f5] px-1.5 py-1 text-xs">docs/HOSPITAL_AUTH_PHASE_3.md</code>.</p>
      </section>
    </div>
  );
}
