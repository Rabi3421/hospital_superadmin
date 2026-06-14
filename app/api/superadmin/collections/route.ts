import { NextRequest } from "next/server";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { collectionBillingMonth, collectionStage } from "@/lib/subscription-collections";
import { getSuperAdminFromRequest } from "@/lib/superadmin-auth";
import BillingReminder from "@/models/BillingReminder";
import Hospital from "@/models/Hospital";
import PlatformPayment from "@/models/PlatformPayment";
import Subscription from "@/models/Subscription";

export async function GET(req: NextRequest) {
  try {
    const admin = await getSuperAdminFromRequest(req);
    if (!admin) return errorResponse("Unauthorized", 401);

    await connectDb();
    const [subscriptions, hospitals, payments, reminders] = await Promise.all([
      Subscription.find({ status: { $ne: "Cancelled" } }).sort({ nextBillingDate: 1 }),
      Hospital.find().select("hospitalId name ownerName ownerEmail ownerPhone status websiteStatus"),
      PlatformPayment.find().sort({ createdAt: -1 }),
      BillingReminder.find().sort({ sentAt: -1 }),
    ]);
    const hospitalMap = new Map(hospitals.map((hospital) => [hospital.hospitalId, hospital]));
    const paymentsByHospital = new Map<string, typeof payments>();
    payments.forEach((payment) => {
      paymentsByHospital.set(payment.hospitalId, [...(paymentsByHospital.get(payment.hospitalId) ?? []), payment]);
    });
    const remindersByHospital = new Map<string, typeof reminders>();
    reminders.forEach((reminder) => {
      remindersByHospital.set(reminder.hospitalId, [...(remindersByHospital.get(reminder.hospitalId) ?? []), reminder]);
    });

    const rows = subscriptions.map((subscription) => {
      const billingMonth = collectionBillingMonth(subscription);
      const hospitalPayments = paymentsByHospital.get(subscription.hospitalId) ?? [];
      const payment = hospitalPayments.find((item) => item.billingMonth === billingMonth && ["Paid", "Pending"].includes(item.status));
      const paid = payment?.status === "Paid";
      const stage = collectionStage(subscription, paid);
      const hospitalReminders = remindersByHospital.get(subscription.hospitalId) ?? [];
      const lastReminder = hospitalReminders.find((reminder) => reminder.billingMonth === billingMonth);
      return {
        hospital: hospitalMap.get(subscription.hospitalId) ?? null,
        subscription,
        billingMonth,
        stage,
        amountDue: paid || ["Trial", "Cancelled"].includes(stage) ? 0 : subscription.monthlyPrice,
        payment: payment ?? null,
        lastReminder: lastReminder ?? null,
        reminderCount: hospitalReminders.filter((reminder) => reminder.billingMonth === billingMonth).length,
      };
    });

    const summary = {
      totalReceivable: rows.reduce((total, row) => total + row.amountDue, 0),
      upcoming: rows.filter((row) => row.stage === "Upcoming").length,
      due: rows.filter((row) => row.stage === "Due").length,
      grace: rows.filter((row) => row.stage === "Grace").length,
      suspended: rows.filter((row) => row.stage === "Suspended").length,
      pendingVerification: rows.filter((row) => row.payment?.status === "Pending").length,
      collected: payments.filter((payment) => payment.status === "Paid").reduce((total, payment) => total + payment.amount, 0),
    };

    return successResponse(serializeDoc({ summary, rows }));
  } catch (error) {
    return handleApiError(error);
  }
}
