import { redirect } from "next/navigation";
import { serializeDoc } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { getSuperAdminFromCookies } from "@/lib/superadmin-auth";
import HospitalDoctorPublicProfile from "@/models/HospitalDoctorPublicProfile";
import { ContentShell, ContentTable } from "../content-components";

export const dynamic = "force-dynamic";

export default async function DoctorsContentPage() {
  const admin = await getSuperAdminFromCookies();
  if (!admin) redirect("/login");
  await connectDb();
  const doctors = serializeDoc(await HospitalDoctorPublicProfile.find().sort({ createdAt: -1 })) as unknown as Array<{
    hospitalId: string; name: string; specialization?: string; status: string;
  }>;
  return <ContentShell title="Doctors" description="Review public doctor profiles published by each hospital."><ContentTable headers={["Hospital ID", "Doctor", "Specialization", "Status"]} statusIndex={3} rows={doctors.map((item) => [item.hospitalId, item.name, item.specialization ?? "Not specified", item.status])} /></ContentShell>;
}
