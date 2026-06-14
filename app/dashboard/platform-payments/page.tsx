import { redirect } from "next/navigation";
import { CircleAlert, CreditCard, Search, SlidersHorizontal, WalletCards } from "lucide-react";
import { serializeDoc } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { getSuperAdminFromCookies } from "@/lib/superadmin-auth";
import Hospital from "@/models/Hospital";
import PlatformPayment from "@/models/PlatformPayment";
import { PageHeader, SummaryCard } from "../components/dashboard-ui";
import PaymentManager, { type PaymentRow } from "./payment-manager";

export const dynamic = "force-dynamic";
type SearchParams = Promise<{ hospitalId?: string; status?: string; billingMonth?: string }>;

export default async function PlatformPaymentsPage({ searchParams }: { searchParams: SearchParams }) {
  const admin = await getSuperAdminFromCookies();
  if (!admin) redirect("/login");
  await connectDb();
  const params = await searchParams;
  const hospitals = serializeDoc(await Hospital.find().select("hospitalId name").sort({ name: 1 })) as unknown as Array<{ hospitalId: string; name: string }>;
  const filter: Record<string, unknown> = {};
  if (params.hospitalId) filter.hospitalId = params.hospitalId;
  if (params.status) filter.status = params.status;
  if (params.billingMonth) filter.billingMonth = params.billingMonth;
  const payments = serializeDoc(await PlatformPayment.find(filter).sort({ paymentDate: -1 }).limit(200)) as unknown as PaymentRow[];
  const total = (status: string) => payments.filter((payment) => payment.status === status).reduce((sum, payment) => sum + payment.amount, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Platform Payments" description="Payments are due on the 5th. Access continues through the 10th and is suspended from the 11th until paid." />
      <section className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Total Paid" value={`₹${total("Paid")}`} icon={WalletCards} />
        <SummaryCard label="Pending" value={`₹${total("Pending")}`} icon={CreditCard} tone="amber" />
        <SummaryCard label="Failed" value={`₹${total("Failed")}`} icon={CircleAlert} tone="red" />
      </section>
      <form className="flex flex-col gap-3 rounded-lg border border-[#e2eae6] bg-white p-4 shadow-[0_12px_32px_rgba(32,45,39,0.04)] md:flex-row">
        <label className="flex h-10 flex-1 items-center gap-2 rounded-md border border-[#dfe8e4] px-3"><Search size={16} className="text-[#8a9591]" /><select name="hospitalId" defaultValue={params.hospitalId ?? ""} className="min-w-0 flex-1 bg-transparent text-sm outline-none"><option value="">All hospitals</option>{hospitals.map((hospital) => <option key={hospital.hospitalId} value={hospital.hospitalId}>{hospital.name}</option>)}</select></label>
        <select name="status" defaultValue={params.status ?? ""} className="h-10 rounded-md border border-[#dfe8e4] px-3 text-sm font-semibold"><option value="">All statuses</option><option>Paid</option><option>Pending</option><option>Failed</option><option>Refunded</option></select>
        <input name="billingMonth" type="month" defaultValue={params.billingMonth} className="h-10 rounded-md border border-[#dfe8e4] px-3 text-sm" />
        <button className="inline-flex h-10 items-center gap-2 rounded-md bg-[#151918] px-4 text-sm font-bold text-white"><SlidersHorizontal size={16} />Apply Filter</button>
      </form>
      <PaymentManager hospitals={hospitals} payments={payments} />
    </div>
  );
}
