import { redirect } from "next/navigation";
import { serializeDoc } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { getSuperAdminFromCookies } from "@/lib/superadmin-auth";
import Hospital from "@/models/Hospital";
import HospitalDepartment from "@/models/HospitalDepartment";
import { ContentShell, ContentTable } from "../content-components";
import DepartmentForm from "./department-form";

export const dynamic = "force-dynamic";

export default async function DepartmentsPage() {
  const admin = await getSuperAdminFromCookies();
  if (!admin) redirect("/login");
  await connectDb();
  const hospitals = serializeDoc(await Hospital.find().select("hospitalId name").sort({ name: 1 })) as unknown as Array<{ hospitalId: string; name: string }>;
  const departments = serializeDoc(await HospitalDepartment.find().sort({ hospitalId: 1, sortOrder: 1 })) as unknown as Array<{
    _id: string; hospitalId: string; name: string; description?: string; status: string;
  }>;

  return (
    <ContentShell title="Departments" description="Organize the departments displayed on hospital public websites." action={<DepartmentForm hospitals={hospitals} />}>
      <ContentTable headers={["Hospital ID", "Department", "Description", "Status"]} statusIndex={3} rows={departments.map((item) => [item.hospitalId, item.name, item.description ?? "No description", item.status])} />
    </ContentShell>
  );
}
