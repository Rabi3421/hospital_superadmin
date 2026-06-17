import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { serializeDoc } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { getSuperAdminFromCookies } from "@/lib/superadmin-auth";
import Hospital from "@/models/Hospital";
import HospitalRowActions from "./hospital-row-actions";

export const dynamic = "force-dynamic";

type HospitalRow = {
  hospitalId: string;
  name: string;
  type: string;
  ownerName: string;
  ownerEmail: string;
  referredBy?: string;
  city: string;
  state: string;
  status: string;
  websiteStatus: string;
};

export default async function HospitalsPage() {
  const admin = await getSuperAdminFromCookies();
  if (!admin) {
    redirect("/login");
  }

  await connectDb();
  const hospitals = serializeDoc(await Hospital.find().sort({ createdAt: -1 }).limit(100)) as unknown as HospitalRow[];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Hospitals</h1>
          <p className="mt-1 text-sm text-slate-600">Manage hospital tenants and subscription state.</p>
        </div>
        <Link
          href="/dashboard/hospitals/new"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800"
        >
          <Plus size={18} />
          Add Hospital
        </Link>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">Hospital</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Owner</th>
                <th className="px-5 py-3">Referred By</th>
                <th className="px-5 py-3">Location</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Website</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {hospitals.map((hospital) => (
                <tr key={hospital.hospitalId}>
                  <td className="px-5 py-4">
                    <Link
                      href={`/dashboard/hospitals/${hospital.hospitalId}`}
                      className="font-semibold text-slate-950 hover:text-teal-700"
                    >
                      {hospital.name}
                    </Link>
                    <p className="text-xs text-slate-500">{hospital.hospitalId}</p>
                  </td>
                  <td className="px-5 py-4 text-slate-700">{hospital.type}</td>
                  <td className="px-5 py-4 text-slate-700">
                    {hospital.ownerName}
                    <p className="text-xs text-slate-500">{hospital.ownerEmail}</p>
                  </td>
                  <td className="px-5 py-4 text-slate-700">{hospital.referredBy || "Not recorded"}</td>
                  <td className="px-5 py-4 text-slate-700">{hospital.city}, {hospital.state}</td>
                  <td className="px-5 py-4 text-slate-700">{hospital.status}</td>
                  <td className="px-5 py-4 text-slate-700">{hospital.websiteStatus}</td>
                  <td className="px-5 py-4">
                    <HospitalRowActions hospitalId={hospital.hospitalId} hospitalStatus={hospital.status} />
                  </td>
                </tr>
              ))}
              {hospitals.length === 0 ? (
                <tr>
                  <td className="px-5 py-8 text-center text-slate-500" colSpan={8}>
                    No hospitals created yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
