import { redirect } from "next/navigation";
import { serializeDoc } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { getSuperAdminFromCookies } from "@/lib/superadmin-auth";
import HospitalGallery from "@/models/HospitalGallery";
import { ContentShell, ContentTable } from "../content-components";

export const dynamic = "force-dynamic";

export default async function GalleryContentPage() {
  const admin = await getSuperAdminFromCookies();
  if (!admin) redirect("/login");
  await connectDb();
  const gallery = serializeDoc(await HospitalGallery.find().sort({ createdAt: -1 })) as unknown as Array<{
    hospitalId: string; title: string; category?: string; status: string;
  }>;
  return <ContentShell title="Gallery" description="Review images available on tenant public websites."><ContentTable headers={["Hospital ID", "Title", "Category", "Status"]} statusIndex={3} rows={gallery.map((item) => [item.hospitalId, item.title, item.category ?? "Uncategorized", item.status])} /></ContentShell>;
}
