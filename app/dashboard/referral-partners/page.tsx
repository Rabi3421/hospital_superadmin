import { redirect } from "next/navigation";
import { Handshake, UserRoundCheck, UsersRound } from "lucide-react";
import { serializeDoc } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { getSuperAdminFromCookies } from "@/lib/superadmin-auth";
import Hospital from "@/models/Hospital";
import ReferralPartner from "@/models/ReferralPartner";
import { PageHeader, SummaryCard } from "../components/dashboard-ui";
import ReferralPartnerManager, { type ReferralPartnerRow } from "./referral-partner-manager";

export const dynamic = "force-dynamic";

export default async function ReferralPartnersPage() {
  const admin = await getSuperAdminFromCookies();
  if (!admin) redirect("/login");
  await connectDb();
  const [partners, hospitalCounts] = await Promise.all([
    ReferralPartner.find().sort({ status: 1, name: 1 }),
    Hospital.aggregate([
      { $match: { referralPartnerId: { $nin: [null, ""] } } },
      { $group: { _id: "$referralPartnerId", count: { $sum: 1 } } },
    ]),
  ]);
  const countMap = new Map(hospitalCounts.map((item) => [item._id, item.count]));
  const rows = partners.map((partner) => ({ ...partner.toObject(), hospitalCount: countMap.get(partner.referralPartnerId) ?? 0 }));
  const data = serializeDoc(rows) as unknown as ReferralPartnerRow[];

  return (
    <div className="space-y-6">
      <PageHeader title="Referral Partners" description="Maintain reusable referral profiles and track who introduced each hospital client." />
      <section className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Total Profiles" value={data.length} icon={UsersRound} />
        <SummaryCard label="Active Partners" value={data.filter((item) => item.status === "Active").length} icon={UserRoundCheck} />
        <SummaryCard label="Referred Hospitals" value={data.reduce((total, item) => total + item.hospitalCount, 0)} icon={Handshake} tone="blue" />
      </section>
      <ReferralPartnerManager partners={data} />
    </div>
  );
}
