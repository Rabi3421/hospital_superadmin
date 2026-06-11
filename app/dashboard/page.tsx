import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Building2,
  CalendarDays,
  CreditCard,
  Download,
  MoreHorizontal,
  Plus,
  Search,
  SlidersHorizontal,
  TrendingUp,
  UserRound,
  UsersRound,
} from "lucide-react";
import { serializeDoc } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { getSuperAdminFromCookies } from "@/lib/superadmin-auth";
import Hospital from "@/models/Hospital";
import HospitalUser from "@/models/HospitalUser";
import PlatformPayment from "@/models/PlatformPayment";
import Subscription from "@/models/Subscription";

export const dynamic = "force-dynamic";

type HospitalRow = {
  hospitalId: string;
  name: string;
  ownerName: string;
  ownerEmail: string;
  status: string;
  websiteStatus: string;
  type?: string;
  city?: string;
  createdAt?: string;
};

export default async function DashboardPage() {
  const admin = await getSuperAdminFromCookies();
  if (!admin) {
    redirect("/login");
  }

  await connectDb();
  const [totalHospitals, activeHospitals, totalUsers, activeSubscriptions, revenueAgg, recentHospitals] =
    await Promise.all([
      Hospital.countDocuments(),
      Hospital.countDocuments({ status: "Active" }),
      HospitalUser.countDocuments(),
      Subscription.countDocuments({ status: { $in: ["Trial", "Active"] } }),
      PlatformPayment.aggregate([{ $match: { status: "Paid" } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
      Hospital.find().sort({ createdAt: -1 }).limit(5),
    ]);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [
    trialHospitals,
    suspendedHospitals,
    cancelledHospitals,
    liveWebsites,
    maintenanceWebsites,
    comingSoonWebsites,
    pendingPlatformPayments,
    overdueSubscriptions,
    newHospitalsThisMonth,
    recentPayments,
  ] = await Promise.all([
    Hospital.countDocuments({ status: "Trial" }),
    Hospital.countDocuments({ status: "Suspended" }),
    Hospital.countDocuments({ status: "Cancelled" }),
    Hospital.countDocuments({ websiteStatus: "Live" }),
    Hospital.countDocuments({ websiteStatus: "Maintenance" }),
    Hospital.countDocuments({ websiteStatus: "Coming Soon" }),
    PlatformPayment.countDocuments({ status: "Pending" }),
    Subscription.countDocuments({ status: "Overdue" }),
    Hospital.countDocuments({ createdAt: { $gte: monthStart } }),
    PlatformPayment.find().sort({ createdAt: -1 }).limit(5),
  ]);

  const hospitals = serializeDoc(recentHospitals) as unknown as HospitalRow[];
  const revenue = revenueAgg[0]?.total ?? 0;
  const chartValues = [
    totalHospitals + 4,
    activeHospitals + 6,
    totalUsers + 3,
    activeSubscriptions + 8,
    totalHospitals + activeHospitals + 5,
    totalUsers + 7,
    activeSubscriptions + 2,
  ];
  const maxChart = Math.max(...chartValues, 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#151918]">Welcome back, {admin.name?.split(" ")[0] ?? "Admin"}</h1>
          <p className="mt-1 text-sm font-medium text-[#7a8581]">Here is the latest update for your hospital SaaS platform.</p>
        </div>
        <div className="flex gap-3">
          <select className="h-11 rounded-none border border-[#dfe8e4] bg-white px-4 text-sm font-bold text-[#394340] outline-none">
            <option>Last Week</option>
            <option>This Month</option>
          </select>
          <button className="inline-flex h-11 items-center gap-2 bg-[#151918] px-5 text-sm font-bold text-white" type="button">
            <Download size={17} />
            Export
          </button>
        </div>
      </div>

      <section className="grid gap-5 xl:grid-cols-4">
        <div className="relative overflow-hidden rounded-lg bg-[#278b7c] p-5 text-white shadow-[0_18px_45px_rgba(31,123,111,0.18)]">
          <div className="absolute -right-4 top-0 text-[160px] font-black leading-none text-white/5">W</div>
          <div className="relative flex items-start justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-white/15">
                <Building2 size={18} />
              </span>
              <p className="text-sm font-bold">Overall hospitals</p>
            </div>
            <MoreHorizontal size={20} />
          </div>
          <div className="relative mt-5 flex items-center gap-3">
            <p className="text-4xl font-bold">{totalHospitals}</p>
            <span className="rounded-full bg-white/20 px-2.5 py-1 text-xs font-bold">+15.2%</span>
          </div>
          <p className="relative mt-4 max-w-[260px] text-sm font-medium leading-6 text-white/85">
            Active platform tenant count with {activeHospitals} hospitals currently live.
          </p>
          <div className="relative mt-5 flex items-center gap-4">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/20">
              <div className="h-full w-3/4 rounded-full bg-white" />
            </div>
            <span className="text-xs font-bold">{activeHospitals} active</span>
          </div>
        </div>

        <MetricCard icon={UsersRound} title="Total users" value={totalUsers} badge="+10.4%">
          <div className="mt-5 flex h-16 items-end gap-2">
            {[35, 58, 76, 48, 68, 59, 72].map((height) => (
              <span key={height} className="w-3 rounded-full bg-[#99e3d3]" style={{ height: `${height}%` }} />
            ))}
          </div>
          <p className="mt-3 text-xs font-medium text-[#7a8581]">Role-based accounts across all tenant hospitals.</p>
        </MetricCard>

        <MetricCard icon={TrendingUp} title="Subscriptions" value={activeSubscriptions} badge="+165">
          <p className="mt-5 text-sm font-medium leading-6 text-[#7a8581]">
            Trial and active subscriptions ready for billing control.
          </p>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#eef2f0]">
            <div className="h-full w-2/3 rounded-full bg-[#278b7c]" />
          </div>
        </MetricCard>

        <MetricCard icon={CreditCard} title="Revenue" value={`₹${revenue}`} badge="+165">
          <div className="mt-5 space-y-4 text-sm font-semibold text-[#687370]">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-[#5aa7f2]" />
                Paid payments
              </span>
              <span className="text-[#151918]">{revenue}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-[#58b99f]" />
                Active tenants
              </span>
              <span className="text-[#151918]">{activeHospitals}</span>
            </div>
          </div>
        </MetricCard>
      </section>

      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <MiniStat label="Trial" value={trialHospitals} />
        <MiniStat label="Suspended" value={suspendedHospitals} />
        <MiniStat label="Cancelled" value={cancelledHospitals} />
        <MiniStat label="Live Websites" value={liveWebsites} />
        <MiniStat label="Maintenance" value={maintenanceWebsites} />
        <MiniStat label="Coming Soon" value={comingSoonWebsites} />
        <MiniStat label="Pending Payments" value={pendingPlatformPayments} />
        <MiniStat label="Overdue Subs" value={overdueSubscriptions} />
        <MiniStat label="New This Month" value={newHospitalsThisMonth} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="rounded-lg border border-[#edf2ef] bg-white p-5 shadow-[0_16px_40px_rgba(32,45,39,0.04)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#edf8f3] text-[#278b7c]">
                <Building2 size={17} />
              </span>
              <h2 className="text-base font-bold text-[#151918]">Tenant Statistics</h2>
            </div>
            <div className="flex items-center gap-5 text-xs font-semibold text-[#687370]">
              <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#278b7c]" />Hospitals</span>
              <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#ffd467]" />Users</span>
            </div>
          </div>
          <div className="mt-8 flex h-[230px] items-end justify-between gap-4">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, index) => {
              const hospitalHeight = Math.max(22, (chartValues[index] / maxChart) * 100);
              const userHeight = Math.max(16, ((chartValues[index] + totalUsers) / (maxChart + Math.max(totalUsers, 1))) * 80);
              return (
                <div key={day} className="flex flex-1 flex-col items-center gap-3">
                  <div className="flex h-44 items-end gap-2">
                    <div className="w-7 rounded-t-sm bg-[#278b7c]" style={{ height: `${hospitalHeight}%` }} />
                    <div className="w-7 rounded-t-sm bg-[#ffd467]" style={{ height: `${userHeight}%` }} />
                  </div>
                  <span className="text-xs font-semibold text-[#7a8581]">{day}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-[#edf2ef] bg-white p-5 shadow-[0_16px_40px_rgba(32,45,39,0.04)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#edf8f3] text-[#278b7c]">
                <CalendarDays size={17} />
              </span>
              <h2 className="text-base font-bold text-[#151918]">Calendar</h2>
            </div>
            <div className="flex gap-3 text-xs font-semibold text-[#687370]">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#9dca2f]" />Trial</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#5aa7f2]" />Active</span>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-[1fr_150px] gap-5">
            <div>
              <div className="mb-4 flex items-center justify-between text-sm font-bold text-[#151918]">
                <span>June 2026</span>
                <span className="text-[#8a9591]">‹ ›</span>
              </div>
              <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-[#9aa5a1]">
                {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
                  <span key={`${day}-${index}`}>{day}</span>
                ))}
                {Array.from({ length: 35 }).map((_, index) => (
                  <span
                    key={index}
                    className={`flex h-8 items-center justify-center rounded-md ${
                      index === 9 ? "border border-[#278b7c] bg-[#edf8f3] text-[#278b7c]" : "text-[#394340]"
                    }`}
                  >
                    {index < 30 ? index + 1 : index - 29}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <h3 className="mb-5 text-sm font-bold text-[#687370]">Activity Details</h3>
              <div className="space-y-4 text-sm font-semibold text-[#151918]">
                <p className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#9dca2f]" />{totalHospitals} tenants</p>
                <p className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#5aa7f2]" />{activeHospitals} active</p>
                <p className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#ffd467]" />{activeSubscriptions} billing</p>
              </div>
              <Link
                href="/dashboard/hospitals/new"
                className="mt-9 inline-flex h-10 w-full items-center justify-center gap-2 border border-[#dfe8e4] bg-white text-sm font-bold text-[#151918] hover:bg-[#f7faf8]"
              >
                <Plus size={16} />
                Add new
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-[#edf2ef] bg-white p-5 shadow-[0_16px_40px_rgba(32,45,39,0.04)]">
        <h2 className="text-base font-bold text-[#151918]">Recent Platform Payments</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <tbody className="divide-y divide-[#eef2f0]">
              {(serializeDoc(recentPayments) as unknown as Array<{ _id: string; hospitalId: string; amount: number; status: string; billingMonth: string }>).map((payment) => (
                <tr key={payment._id}>
                  <td className="p-4 font-bold text-[#151918]">{payment.hospitalId}</td>
                  <td className="p-4 font-semibold text-[#394340]">₹{payment.amount}</td>
                  <td className="p-4 font-semibold text-[#394340]">{payment.billingMonth}</td>
                  <td className="p-4 font-semibold text-[#394340]">{payment.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-[#edf2ef] bg-white p-5 shadow-[0_16px_40px_rgba(32,45,39,0.04)]">
        <div className="flex flex-col justify-between gap-4 border-b border-[#eef2f0] pb-4 md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#edf8f3] text-[#278b7c]">
              <UsersRound size={17} />
            </span>
            <h2 className="text-base font-bold text-[#151918]">All Hospitals</h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex h-10 min-w-[280px] items-center gap-2 rounded-md border border-[#dfe8e4] px-3 text-sm font-medium text-[#8a9591]">
              <Search size={17} />
              Search anything here
            </div>
            <button type="button" className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#dfe8e4] px-4 text-sm font-bold text-[#151918]">
              <SlidersHorizontal size={16} />
              Filter
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="text-xs font-bold text-[#9aa5a1]">
              <tr>
                <th className="px-4 py-4">No</th>
                <th className="px-4 py-4">ID Code</th>
                <th className="px-4 py-4">Hospital Name</th>
                <th className="px-4 py-4">City</th>
                <th className="px-4 py-4">Type</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eef2f0]">
              {hospitals.map((hospital, index) => (
                <tr key={hospital.hospitalId}>
                  <td className="px-4 py-4 font-bold text-[#151918]">{String(index + 1).padStart(2, "0")}</td>
                  <td className="px-4 py-4 font-bold text-[#151918]">{hospital.hospitalId}</td>
                  <td className="px-4 py-4">
                    <Link href={`/dashboard/hospitals/${hospital.hospitalId}`} className="font-medium text-slate-950">
                      <span className="inline-flex items-center gap-3 font-bold text-[#151918]">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[#dfe8e4]">
                          <UserRound size={16} />
                        </span>
                        {hospital.name}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-4 font-semibold text-[#394340]">{hospital.city ?? "N/A"}</td>
                  <td className="px-4 py-4 font-semibold text-[#394340]">{hospital.type ?? "Hospital"}</td>
                  <td className="px-4 py-4">
                    <span className={`rounded-full px-4 py-1.5 text-xs font-bold ${
                      hospital.status === "Active"
                        ? "bg-[#e2f6f1] text-[#278b7c]"
                        : hospital.status === "Suspended"
                          ? "bg-[#fde8df] text-[#c06a3f]"
                          : "bg-[#fff2d6] text-[#b88719]"
                    }`}>
                      {hospital.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right text-[#8a9591]">
                    <MoreHorizontal size={19} />
                  </td>
                </tr>
              ))}
              {hospitals.length === 0 ? (
                <tr>
                  <td className="px-4 py-10 text-center font-semibold text-[#8a9591]" colSpan={7}>
                    No hospitals created yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-[#edf2ef] bg-white p-4">
      <p className="text-xs font-bold text-[#8a9591]">{label}</p>
      <p className="mt-2 text-2xl font-bold text-[#151918]">{value}</p>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  title,
  value,
  badge,
  children,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  value: string | number;
  badge: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[#edf2ef] bg-white p-5 shadow-[0_16px_40px_rgba(32,45,39,0.04)]">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#edf8f3] text-[#278b7c]">
            <Icon size={18} />
          </span>
          <p className="text-sm font-bold text-[#687370]">{title}</p>
        </div>
        <MoreHorizontal className="text-[#8a9591]" size={20} />
      </div>
      <div className="mt-5 flex items-center gap-3">
        <p className="text-4xl font-bold tracking-tight text-[#151918]">{value}</p>
        <span className="rounded-full bg-[#dff8ef] px-2.5 py-1 text-xs font-bold text-[#278b7c]">{badge}</span>
      </div>
      {children}
    </div>
  );
}
