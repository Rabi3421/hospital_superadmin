import { redirect } from "next/navigation";
import { CreditCard, Search, SlidersHorizontal } from "lucide-react";
import { serializeDoc } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { getSuperAdminFromCookies } from "@/lib/superadmin-auth";
import Hospital from "@/models/Hospital";
import Subscription from "@/models/Subscription";
import SubscriptionTable, { type SubscriptionRow } from "./subscription-table";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ q?: string; status?: string; hospitalId?: string }>;

export default async function SubscriptionsPage({ searchParams }: { searchParams: SearchParams }) {
  const admin = await getSuperAdminFromCookies();
  if (!admin) redirect("/login");

  await connectDb();
  const params = await searchParams;
  const hospitalFilter: Record<string, unknown> = {};
  if (params.q) hospitalFilter.$or = [{ name: new RegExp(params.q, "i") }, { hospitalId: new RegExp(params.q, "i") }];
  if (params.hospitalId) hospitalFilter.hospitalId = params.hospitalId;

  const hospitals = await Hospital.find(hospitalFilter).select("hospitalId name");
  const hospitalMap = new Map(hospitals.map((hospital) => [hospital.hospitalId, hospital.name]));
  const filter: Record<string, unknown> = { hospitalId: { $in: [...hospitalMap.keys()] } };
  if (params.status) filter.status = params.status;

  const docs = serializeDoc(await Subscription.find(filter).sort({ updatedAt: -1 })) as unknown as Array<Omit<SubscriptionRow, "hospitalName">>;
  const subscriptions: SubscriptionRow[] = docs.map((subscription) => ({
    ...subscription,
    hospitalName: hospitalMap.get(subscription.hospitalId) ?? subscription.hospitalId,
  }));
  const allStatuses = await Subscription.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]);
  const statusCount = (status: string) => allStatuses.find((item) => item._id === status)?.count ?? 0;
  const monthlyRevenue = subscriptions.filter((item) => item.status === "Active").reduce((total, item) => total + item.monthlyPrice, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#151918]">Subscriptions</h1>
        <p className="mt-1 text-sm font-medium text-[#7a8581]">Review plans and update a subscription only when action is needed.</p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Summary label="Active Subscriptions" value={statusCount("Active")} />
        <Summary label="Trial Subscriptions" value={statusCount("Trial")} />
        <Summary label="Overdue" value={statusCount("Overdue")} warning />
        <Summary label="Active Monthly Value" value={`₹${monthlyRevenue}`} />
      </section>

      <form className="flex flex-col gap-3 rounded-lg border border-[#e2eae6] bg-white p-4 shadow-[0_12px_32px_rgba(32,45,39,0.04)] md:flex-row">
        <label className="flex h-10 flex-1 items-center gap-2 rounded-md border border-[#dfe8e4] px-3">
          <Search size={16} className="text-[#8a9591]" />
          <input name="q" placeholder="Search hospital name or ID" defaultValue={params.q} className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
        </label>
        <select name="status" defaultValue={params.status ?? ""} className="h-10 rounded-md border border-[#dfe8e4] bg-white px-3 text-sm font-semibold">
          <option value="">All subscription statuses</option>
          <option>Trial</option><option>Active</option><option>Overdue</option><option>Suspended</option><option>Cancelled</option>
        </select>
        <button className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#151918] px-4 text-sm font-bold text-white hover:bg-[#278b7c]">
          <SlidersHorizontal size={16} />
          Apply Filter
        </button>
      </form>

      <SubscriptionTable subscriptions={subscriptions} />
    </div>
  );
}

function Summary({ label, value, warning = false }: { label: string; value: string | number; warning?: boolean }) {
  return (
    <div className="rounded-lg border border-[#e2eae6] bg-white p-5 shadow-[0_12px_32px_rgba(32,45,39,0.04)]">
      <div className="flex items-center gap-2">
        <span className={`flex h-8 w-8 items-center justify-center rounded-md ${warning ? "bg-red-50 text-red-700" : "bg-[#edf8f3] text-[#278b7c]"}`}>
          <CreditCard size={16} />
        </span>
        <p className="text-sm font-bold text-[#687370]">{label}</p>
      </div>
      <p className="mt-4 text-3xl font-bold text-[#151918]">{value}</p>
    </div>
  );
}
