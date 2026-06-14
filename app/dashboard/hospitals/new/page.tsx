import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { serializeDoc } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import ReferralPartner from "@/models/ReferralPartner";
import NewHospitalForm from "./new-hospital-form";

export const dynamic = "force-dynamic";

export default async function NewHospitalPage() {
  await connectDb();
  const referralPartners = serializeDoc(
    await ReferralPartner.find({ status: "Active" }).select("referralPartnerId name phone email organization type").sort({ name: 1 }),
  ) as unknown as Array<{ referralPartnerId: string; name: string; phone?: string; email?: string; organization?: string; type: string }>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Add Hospital</h1>
          <p className="mt-1 text-sm text-slate-600">Create a tenant, subscription, and trial window.</p>
        </div>
        <Link
          href="/dashboard/hospitals"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#dfe8e4] bg-white px-4 text-sm font-bold text-[#394340] hover:bg-[#f3f7f5]"
        >
          <ArrowLeft size={17} />
          Back to Hospitals
        </Link>
      </div>
      <NewHospitalForm initialReferralPartners={referralPartners} />
    </div>
  );
}
