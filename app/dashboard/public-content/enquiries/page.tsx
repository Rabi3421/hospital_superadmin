import { redirect } from "next/navigation";
import { serializeDoc } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { getSuperAdminFromCookies } from "@/lib/superadmin-auth";
import HospitalContactEnquiry from "@/models/HospitalContactEnquiry";
import { ContentShell, ContentTable } from "../content-components";

export const dynamic = "force-dynamic";

export default async function EnquiriesContentPage() {
  const admin = await getSuperAdminFromCookies();
  if (!admin) redirect("/login");
  await connectDb();
  const enquiries = serializeDoc(await HospitalContactEnquiry.find().sort({ createdAt: -1 })) as unknown as Array<{
    hospitalId: string; name: string; phone: string; status: string;
  }>;
  return <ContentShell title="Contact Enquiries" description="Review messages submitted from hospital public websites."><ContentTable headers={["Hospital ID", "Name", "Phone", "Status"]} statusIndex={3} rows={enquiries.map((item) => [item.hospitalId, item.name, item.phone, item.status])} /></ContentShell>;
}
