import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { serializeDoc } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { getSuperAdminFromCookies } from "@/lib/superadmin-auth";
import Hospital from "@/models/Hospital";
import ReferralPartner from "@/models/ReferralPartner";
import EditHospitalForm from "./edit-hospital-form";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ hospitalId: string }> };

export default async function EditHospitalPage({ params }: PageProps) {
  const admin = await getSuperAdminFromCookies();
  if (!admin) redirect("/login");

  await connectDb();
  const { hospitalId } = await params;
  const [hospitalDoc, referralPartnerDocs] = await Promise.all([
    Hospital.findOne({ hospitalId }),
    ReferralPartner.find({ status: "Active" }).select("referralPartnerId name organization type").sort({ name: 1 }),
  ]);
  if (!hospitalDoc) notFound();
  const hospital = serializeDoc(hospitalDoc);
  const referralPartners = serializeDoc(referralPartnerDocs);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-bold text-[#278b7c]">{hospital.hospitalId}</p>
          <h1 className="mt-1 text-2xl font-bold text-[#151918]">Edit {hospital.name}</h1>
          <p className="mt-1 text-sm font-medium text-[#7a8581]">Update hospital profile, ownership, capacity, and status.</p>
        </div>
        <Link
          href={`/dashboard/hospitals/${hospital.hospitalId}`}
          className="inline-flex h-10 items-center gap-2 rounded-md border border-[#dfe8e4] bg-white px-4 text-sm font-bold text-[#394340] hover:bg-[#f3f7f5]"
        >
          <ArrowLeft size={17} />
          Back to Details
        </Link>
      </div>
      <EditHospitalForm hospital={hospital} referralPartners={referralPartners} />
    </div>
  );
}
