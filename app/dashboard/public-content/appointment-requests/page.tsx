import { redirect } from "next/navigation";
import { serializeDoc } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { getSuperAdminFromCookies } from "@/lib/superadmin-auth";
import HospitalAppointmentRequest from "@/models/HospitalAppointmentRequest";
import { ContentShell, ContentTable } from "../content-components";

export const dynamic = "force-dynamic";

export default async function AppointmentRequestsContentPage() {
  const admin = await getSuperAdminFromCookies();
  if (!admin) redirect("/login");
  await connectDb();
  const requests = serializeDoc(await HospitalAppointmentRequest.find().sort({ createdAt: -1 })) as unknown as Array<{
    hospitalId: string; patientName: string; phone: string; preferredDate: string; status: string;
  }>;
  return <ContentShell title="Appointment Requests" description="Review appointment requests submitted from hospital public websites."><ContentTable headers={["Hospital ID", "Patient", "Phone", "Preferred Date", "Status"]} statusIndex={4} rows={requests.map((item) => [item.hospitalId, item.patientName, item.phone, new Date(item.preferredDate).toLocaleDateString(), item.status])} /></ContentShell>;
}
