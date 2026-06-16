import { redirect } from "next/navigation";
import { ShieldCheck, UserRoundCheck, UsersRound } from "lucide-react";
import { serializeDoc } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { getSuperAdminFromCookies } from "@/lib/superadmin-auth";
import Hospital from "@/models/Hospital";
import HospitalUser from "@/models/HospitalUser";
import { PageHeader, SummaryCard } from "../components/dashboard-ui";
import HospitalUserManager from "./hospital-user-manager";

export const dynamic = "force-dynamic";

export default async function HospitalUsersPage() {
  const admin = await getSuperAdminFromCookies();
  if (!admin) redirect("/login");
  await connectDb();

  const [hospitals, users] = await Promise.all([
    Hospital.find({ status: { $ne: "Cancelled" } }).select("hospitalId name").sort({ name: 1 }),
    HospitalUser.find().select("-passwordHash").sort({ createdAt: -1 }).limit(200),
  ]);
  const hospitalOptions = serializeDoc(hospitals) as unknown as Array<{ hospitalId: string; name: string }>;
  const hospitalUsers = serializeDoc(users) as unknown as Array<{ _id: string; hospitalId: string; name: string; email: string; phone: string; role: string; status: string }>;

  return (
    <div className="space-y-6">
      <PageHeader title="Hospital Users" description="Manage tenant owners, administrators, staff roles, and access status." />
      <section className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Total Users" value={hospitalUsers.length} icon={UsersRound} />
        <SummaryCard label="Active Users" value={hospitalUsers.filter((user) => user.status === "Active").length} icon={UserRoundCheck} />
        <SummaryCard label="Admin Accounts" value={hospitalUsers.filter((user) => user.role === "HOSPITAL_ADMIN").length} icon={ShieldCheck} tone="blue" />
      </section>
      <HospitalUserManager hospitals={hospitalOptions} users={hospitalUsers} />
    </div>
  );
}
