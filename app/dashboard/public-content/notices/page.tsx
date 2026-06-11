import { redirect } from "next/navigation";
import { serializeDoc } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { getSuperAdminFromCookies } from "@/lib/superadmin-auth";
import Hospital from "@/models/Hospital";
import HospitalNotice from "@/models/HospitalNotice";
import { ContentShell, ContentTable } from "../content-components";
import NoticeForm from "./notice-form";

export const dynamic = "force-dynamic";

export default async function NoticesPage() {
  const admin = await getSuperAdminFromCookies();
  if (!admin) redirect("/login");
  await connectDb();
  const hospitals = serializeDoc(await Hospital.find().select("hospitalId name").sort({ name: 1 })) as unknown as Array<{ hospitalId: string; name: string }>;
  const notices = serializeDoc(await HospitalNotice.find().sort({ createdAt: -1 })) as unknown as Array<{ hospitalId: string; title: string; type: string; status: string }>;
  return <ContentShell title="Notices" description="Publish announcements and important notices for hospital websites." action={<NoticeForm hospitals={hospitals} />}><ContentTable headers={["Hospital ID", "Title", "Type", "Status"]} statusIndex={3} rows={notices.map((item) => [item.hospitalId, item.title, item.type, item.status])} /></ContentShell>;
}
