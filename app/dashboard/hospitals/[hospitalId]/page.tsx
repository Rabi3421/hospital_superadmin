import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Building2, CreditCard, Pencil, UsersRound } from "lucide-react";
import { serializeDoc } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { getSuperAdminFromCookies } from "@/lib/superadmin-auth";
import Hospital from "@/models/Hospital";
import HospitalUser from "@/models/HospitalUser";
import PlatformPayment from "@/models/PlatformPayment";
import Subscription from "@/models/Subscription";
import CopyHospitalId from "./copy-hospital-id";
import HospitalActions from "./hospital-actions";

export const dynamic = "force-dynamic";

type HospitalDetail = {
  hospitalId: string;
  name: string;
  slug: string;
  type: string;
  ownerName: string;
  ownerPhone: string;
  ownerEmail: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  status: string;
  websiteStatus: string;
  subscriptionPlan: string;
  monthlyPrice: number;
  nextBillingDate?: string;
};

type SubscriptionDetail = {
  planName: string;
  status: string;
  billingCycle: string;
} | null;

type HospitalUserRow = {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  status: string;
};

type PageProps = {
  params: Promise<{ hospitalId: string }>;
};

export default async function HospitalDetailPage({ params }: PageProps) {
  const admin = await getSuperAdminFromCookies();
  if (!admin) {
    redirect("/login");
  }

  await connectDb();
  const { hospitalId } = await params;
  const [hospitalDoc, subscriptionDoc, users] = await Promise.all([
    Hospital.findOne({ hospitalId }),
    Subscription.findOne({ hospitalId }).sort({ createdAt: -1 }),
    HospitalUser.find({ hospitalId }).select("-passwordHash").sort({ createdAt: -1 }).limit(20),
  ]);

  if (!hospitalDoc) {
    notFound();
  }

  const hospital = serializeDoc(hospitalDoc) as HospitalDetail;
  const subscription = serializeDoc(subscriptionDoc) as SubscriptionDetail;
  const hospitalUsers = serializeDoc(users) as unknown as HospitalUserRow[];
  const [userCount, paymentSummary] = await Promise.all([
    HospitalUser.countDocuments({ hospitalId }),
    PlatformPayment.aggregate([
      { $match: { hospitalId } },
      {
        $group: {
          _id: "$status",
          amount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);
  const paid = paymentSummary.find((item) => item._id === "Paid");
  const pending = paymentSummary.find((item) => item._id === "Pending");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/hospitals" className="inline-flex items-center gap-2 text-sm font-bold text-[#687370] hover:text-[#278b7c]">
          <ArrowLeft size={16} />
          Hospitals
        </Link>
      </div>

      <section className="flex flex-col justify-between gap-5 rounded-lg border border-[#e2eae6] bg-white p-5 shadow-[0_12px_32px_rgba(32,45,39,0.05)] lg:flex-row lg:items-center">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-[#e7f5f0] text-[#278b7c]">
            <Building2 size={27} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-bold tracking-tight text-[#151918]">{hospital.name}</h1>
              <StatusBadge value={hospital.status} />
              <StatusBadge value={hospital.websiteStatus} />
            </div>
            <p className="mt-1 text-sm font-semibold text-[#687370]">
              {hospital.type} · {hospital.city}, {hospital.state}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <CopyHospitalId hospitalId={hospital.hospitalId} />
              <span className="text-xs font-semibold text-[#8a9591]">Slug: {hospital.slug}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/dashboard/hospitals/${hospital.hospitalId}/edit`}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#dfe8e4] bg-white px-4 text-sm font-bold text-[#394340] hover:bg-[#f3f7f5]"
          >
            <Pencil size={16} />
            Edit Hospital
          </Link>
          <Link
            href={`/dashboard/hospital-users?hospitalId=${hospital.hospitalId}`}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#278b7c] px-4 text-sm font-bold text-white hover:bg-[#1f7b6f]"
          >
            <UsersRound size={16} />
            Manage Users
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <InfoCard title="Hospital Profile" icon={<Building2 size={18} />}>
          <Info label="Type" value={hospital.type} />
          <Info label="Location" value={`${hospital.city}, ${hospital.state}`} />
          <Info label="Address" value={`${hospital.address}, ${hospital.pincode}`} />
        </InfoCard>
        <InfoCard title="Owner Details" icon={<UsersRound size={18} />}>
          <Info label="Name" value={hospital.ownerName} />
          <Info label="Email" value={hospital.ownerEmail} />
          <Info label="Phone" value={hospital.ownerPhone} />
        </InfoCard>
        <InfoCard title="Subscription" icon={<CreditCard size={18} />}>
          <Info label="Plan" value={subscription?.planName ?? hospital.subscriptionPlan} />
          <Info label="Status" value={subscription?.status ?? "Not created"} />
          <Info label="Billing Cycle" value={subscription?.billingCycle ?? "Monthly"} />
        </InfoCard>
        <InfoCard title="Platform Summary" icon={<CreditCard size={18} />}>
          <Info label="Hospital Users" value={userCount} />
          <Info label="Paid Revenue" value={`₹${paid?.amount ?? 0}`} />
          <Info label="Payment Due" value={`₹${pending?.amount ?? 0}`} />
        </InfoCard>
      </section>

      <HospitalActions
        hospitalId={hospital.hospitalId}
        hospitalStatus={hospital.status}
        currentWebsiteStatus={hospital.websiteStatus as "Live" | "Maintenance" | "Coming Soon"}
      />

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-950">Hospital Users</h2>
            <p className="mt-1 text-xs font-semibold text-[#8a9591]">Recent users for this tenant.</p>
          </div>
          <Link href={`/dashboard/hospital-users?hospitalId=${hospital.hospitalId}`} className="text-sm font-bold text-[#278b7c] hover:text-[#1f7b6f]">
            Manage all users
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">User</th>
                <th className="px-5 py-3">Phone</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {hospitalUsers.map((user) => (
                <tr key={user._id}>
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-950">{user.name}</p>
                    <p className="text-xs text-slate-500">{user.email}</p>
                  </td>
                  <td className="px-5 py-4 text-slate-700">{user.phone}</td>
                  <td className="px-5 py-4 text-slate-700">{user.role}</td>
                  <td className="px-5 py-4 text-slate-700">{user.status}</td>
                </tr>
              ))}
              {hospitalUsers.length === 0 ? (
                <tr>
                  <td className="px-5 py-8 text-center text-slate-500" colSpan={4}>
                    No hospital users created yet.
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

function InfoCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[#e2eae6] bg-white p-5 shadow-[0_12px_32px_rgba(32,45,39,0.04)]">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#edf8f3] text-[#278b7c]">{icon}</span>
        <h2 className="text-sm font-bold text-[#151918]">{title}</h2>
      </div>
      <div className="mt-5 space-y-4">{children}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase text-[#8a9591]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[#394340]">{value}</p>
    </div>
  );
}

function StatusBadge({ value }: { value: string }) {
  const style =
    value === "Active" || value === "Live"
      ? "bg-[#e2f6f1] text-[#278b7c]"
      : value === "Suspended" || value === "Cancelled" || value === "Maintenance"
        ? "bg-[#fdeae5] text-[#b95f45]"
        : "bg-[#fff2d6] text-[#a87918]";

  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${style}`}>{value}</span>;
}
