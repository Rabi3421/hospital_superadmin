import { redirect } from "next/navigation";
import { Bell, Database, KeyRound, ShieldCheck } from "lucide-react";
import { getSuperAdminFromCookies } from "@/lib/superadmin-auth";
import { PageHeader } from "../components/dashboard-ui";

export default async function SettingsPage() {
  const admin = await getSuperAdminFromCookies();
  if (!admin) redirect("/login");

  const settings = [
    { icon: ShieldCheck, title: "Security", description: "JWT secrets, cookie security, and superadmin access are managed through environment configuration.", value: "Protected" },
    { icon: Database, title: "Database", description: "Central MongoDB connection used by platform and tenant-scoped APIs.", value: "Connected by environment" },
    { icon: Bell, title: "Notifications", description: "Platform notification channels will be configured in a future phase.", value: "Not configured" },
    { icon: KeyRound, title: "Hospital Authentication", description: "Hospital users authenticate with a separate tenant-bound HTTP-only cookie.", value: "Enabled" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Review platform configuration and security readiness." />
      <section className="grid gap-4 md:grid-cols-2">
        {settings.map((setting) => {
          const Icon = setting.icon;
          return (
            <article key={setting.title} className="rounded-lg border border-[#e2eae6] bg-white p-5 shadow-[0_12px_32px_rgba(32,45,39,0.04)]">
              <div className="flex items-start gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#edf8f3] text-[#278b7c]"><Icon size={19} /></span>
                <div>
                  <h2 className="text-base font-bold text-[#151918]">{setting.title}</h2>
                  <p className="mt-2 text-sm font-medium leading-6 text-[#7a8581]">{setting.description}</p>
                  <span className="mt-4 inline-flex rounded-full bg-[#f3f7f5] px-3 py-1.5 text-xs font-bold text-[#687370]">{setting.value}</span>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
