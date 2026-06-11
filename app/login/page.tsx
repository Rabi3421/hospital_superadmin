import { redirect } from "next/navigation";
import { getSuperAdminFromCookies } from "@/lib/superadmin-auth";
import LoginForm from "./login-form";

export default async function LoginPage() {
  const admin = await getSuperAdminFromCookies();
  if (admin) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-[#eef3f1] p-4 sm:p-6">
      <div className="grid min-h-[calc(100vh-32px)] overflow-hidden rounded-[24px] border border-white/70 bg-white shadow-[0_24px_80px_rgba(31,46,41,0.12)] lg:grid-cols-[1.08fr_0.92fr]">
        <section className="relative hidden bg-[#278b7c] p-10 text-white lg:block">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute -left-24 top-10 h-72 w-72 rounded-full border border-white" />
            <div className="absolute bottom-10 right-0 h-96 w-96 rounded-full border border-white" />
            <div className="absolute right-24 top-24 text-[260px] font-black leading-none">W</div>
          </div>
          <div className="relative flex h-full flex-col justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/15 text-2xl font-black">+</span>
                <div>
                  <p className="text-2xl font-bold leading-6">WeCare</p>
                  <p className="mt-1 text-sm font-medium text-white/75">Medical Admin Dashboard</p>
                </div>
              </div>
              <div className="mt-20 max-w-xl">
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-white/70">Central SaaS Control</p>
                <h1 className="mt-5 text-5xl font-bold leading-tight tracking-tight">
                  Manage every hospital tenant from one calm, focused console.
                </h1>
                <p className="mt-6 max-w-lg text-base font-medium leading-8 text-white/78">
                  Onboard hospitals, control subscriptions, manage users, and keep public tenant APIs organized for every hospital.
                </p>
              </div>
            </div>
            <div className="grid max-w-xl grid-cols-3 gap-4">
              {[
                ["Tenants", "Live control"],
                ["Billing", "Plan status"],
                ["Roles", "User access"],
              ].map(([title, text]) => (
                <div key={title} className="rounded-lg bg-white/12 p-4 backdrop-blur">
                  <p className="text-lg font-bold">{title}</p>
                  <p className="mt-1 text-sm font-medium text-white/70">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="flex items-center justify-center px-5 py-10 sm:px-10">
          <LoginForm />
        </section>
      </div>
    </main>
  );
}
