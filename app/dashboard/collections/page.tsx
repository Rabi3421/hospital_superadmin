import { redirect } from "next/navigation";
import { serializeDoc } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { collectionBillingMonth, collectionStage } from "@/lib/subscription-collections";
import { getSuperAdminFromCookies } from "@/lib/superadmin-auth";
import BillingReminder from "@/models/BillingReminder";
import Hospital from "@/models/Hospital";
import PlatformPayment from "@/models/PlatformPayment";
import Subscription from "@/models/Subscription";
import CollectionsManager, { type CollectionRow } from "./collections-manager";

export const dynamic = "force-dynamic";

export default async function CollectionsPage() {
  const admin = await getSuperAdminFromCookies();
  if (!admin) redirect("/login");
  await connectDb();

  const [subscriptions, hospitals, payments, reminders] = await Promise.all([
    Subscription.find({ status: { $ne: "Cancelled" } }).sort({ nextBillingDate: 1 }),
    Hospital.find().select("hospitalId name ownerName ownerEmail ownerPhone status"),
    PlatformPayment.find().sort({ createdAt: -1 }),
    BillingReminder.find().sort({ sentAt: -1 }),
  ]);
  const hospitalMap = new Map(hospitals.map((hospital) => [hospital.hospitalId, hospital]));
  const rows = subscriptions.map((subscription) => {
    const billingMonth = collectionBillingMonth(subscription);
    const payment = payments.find((item) => item.hospitalId === subscription.hospitalId && item.billingMonth === billingMonth && ["Paid", "Pending"].includes(item.status));
    const lastReminder = reminders.find((item) => item.hospitalId === subscription.hospitalId && item.billingMonth === billingMonth);
    const stage = collectionStage(subscription, payment?.status === "Paid");
    return {
      hospital: hospitalMap.get(subscription.hospitalId)?.toObject() ?? null,
      subscription: subscription.toObject(),
      billingMonth,
      stage,
      amountDue: payment?.status === "Paid" || ["Trial", "Cancelled"].includes(stage) ? 0 : subscription.monthlyPrice,
      payment: payment?.toObject() ?? null,
      lastReminder: lastReminder?.toObject() ?? null,
      reminderCount: reminders.filter((item) => item.hospitalId === subscription.hospitalId && item.billingMonth === billingMonth).length,
    };
  });

  return <CollectionsManager rows={serializeDoc(rows) as unknown as CollectionRow[]} />;
}
