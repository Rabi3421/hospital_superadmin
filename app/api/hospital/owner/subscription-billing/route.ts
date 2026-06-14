import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { requireOwnerBillingAuth } from "@/lib/hospital-auth";
import { billingMonthFor, reconcileSubscriptionBilling } from "@/lib/subscription-billing";
import { getSubscriptionPlan } from "@/lib/subscription-plans";
import PlatformPayment from "@/models/PlatformPayment";
import BillingReminder from "@/models/BillingReminder";

const paymentNotificationSchema = z.object({
  transactionId: z.string().trim().min(4).max(120),
  paymentMode: z.enum(["UPI", "Bank Transfer", "Card", "Online"]),
  paymentDate: z.coerce.date(),
  notes: z.string().trim().max(500).optional(),
});

async function billingData(hospitalId: string) {
  const subscription = await reconcileSubscriptionBilling(hospitalId);
  if (!subscription) throw new Error("Subscription not found");

  const [payments, reminders] = await Promise.all([
    PlatformPayment.find({ hospitalId })
      .select("amount paymentDate paymentMode transactionId billingMonth status notes createdAt updatedAt")
      .sort({ billingMonth: -1, createdAt: -1 })
      .limit(100),
    BillingReminder.find({ hospitalId, channel: "In App" })
      .select("billingMonth stage message sentAt")
      .sort({ sentAt: -1 })
      .limit(20),
  ]);
  const plan = getSubscriptionPlan(subscription.planName);
  const paidPayments = payments.filter((payment) => payment.status === "Paid");
  const pendingPayments = payments.filter((payment) => payment.status === "Pending");

  return {
    subscription,
    plan: plan ? {
      name: plan.name,
      description: plan.description,
      features: [...plan.features],
      allowedRoles: [...plan.allowedRoles],
      standardPrice: plan.priceOptions[0],
    } : null,
    limits: {
      maxDoctors: plan?.maxDoctors ?? null,
      maxStaff: plan?.maxStaff ?? null,
      maxPatients: plan?.maxPatients ?? null,
    },
    billingPolicy: {
      dueDay: 5,
      graceThroughDay: 10,
      suspensionStartsDay: 11,
      timezone: "Asia/Kolkata",
    },
    currentBillingMonth: subscription.nextBillingDate ? billingMonthFor(subscription.nextBillingDate) : null,
    totals: {
      paidAmount: paidPayments.reduce((total, payment) => total + payment.amount, 0),
      paidPayments: paidPayments.length,
      pendingPayments: pendingPayments.length,
    },
    payments,
    reminders,
  };
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireOwnerBillingAuth(req);
    return successResponse(serializeDoc(await billingData(session.payload.hospitalId)), "Subscription billing fetched");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireOwnerBillingAuth(req);
    const body = paymentNotificationSchema.parse(await req.json());
    if (body.paymentDate.getTime() > Date.now()) {
      return errorResponse("Payment date cannot be in the future", 422);
    }
    const subscription = await reconcileSubscriptionBilling(session.payload.hospitalId);
    if (!subscription?.nextBillingDate) return errorResponse("Subscription billing date is not configured", 409);
    if (subscription.monthlyPrice <= 0) return errorResponse("No payment is due for the free trial plan", 409);

    const billingMonth = billingMonthFor(subscription.nextBillingDate);
    const existing = await PlatformPayment.exists({
      hospitalId: session.payload.hospitalId,
      $or: [
        { billingMonth, status: { $in: ["Paid", "Pending"] } },
        { transactionId: body.transactionId, status: { $in: ["Paid", "Pending"] } },
      ],
    });
    if (existing) return errorResponse("A paid or pending payment already exists for this billing month or transaction ID", 409);

    await PlatformPayment.create({
      hospitalId: session.payload.hospitalId,
      amount: subscription.monthlyPrice,
      paymentDate: body.paymentDate,
      paymentMode: body.paymentMode,
      transactionId: body.transactionId,
      billingMonth,
      status: "Pending",
      source: "Owner Submission",
      notes: body.notes ?? "",
    });

    return successResponse(serializeDoc(await billingData(session.payload.hospitalId)), "Payment submitted for verification", 201);
  } catch (error) {
    return handleApiError(error);
  }
}
