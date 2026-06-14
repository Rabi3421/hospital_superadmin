import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { collectionBillingMonth, collectionStage, defaultReminderMessage } from "@/lib/subscription-collections";
import { getSuperAdminFromRequest } from "@/lib/superadmin-auth";
import BillingReminder from "@/models/BillingReminder";
import Hospital from "@/models/Hospital";
import PlatformPayment from "@/models/PlatformPayment";
import Subscription from "@/models/Subscription";

const reminderSchema = z.object({
  channel: z.enum(["Email", "Phone", "WhatsApp", "In App"]),
  message: z.string().trim().max(1000).optional(),
});

type RouteContext = { params: Promise<{ hospitalId: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const admin = await getSuperAdminFromRequest(req);
    if (!admin) return errorResponse("Unauthorized", 401);
    await connectDb();
    const { hospitalId } = await context.params;
    const reminders = await BillingReminder.find({ hospitalId }).sort({ sentAt: -1 }).limit(100);
    return successResponse(serializeDoc(reminders));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const admin = await getSuperAdminFromRequest(req);
    if (!admin) return errorResponse("Unauthorized", 401);
    const body = reminderSchema.parse(await req.json());
    await connectDb();
    const { hospitalId } = await context.params;
    const [hospital, subscription] = await Promise.all([
      Hospital.findOne({ hospitalId }),
      Subscription.findOne({ hospitalId }),
    ]);
    if (!hospital) return errorResponse("Hospital not found", 404);
    if (!subscription) return errorResponse("Subscription not found", 404);

    const billingMonth = collectionBillingMonth(subscription);
    const paid = billingMonth
      ? await PlatformPayment.exists({ hospitalId, billingMonth, status: "Paid", amount: { $gte: subscription.monthlyPrice } })
      : false;
    const stage = collectionStage(subscription, Boolean(paid));
    if (["Paid", "Trial", "Cancelled"].includes(stage)) {
      return errorResponse("No collection reminder is required for this account", 409);
    }
    const reminderStage: "Upcoming" | "Due" | "Grace" | "Suspended" | "Manual" =
      stage === "Upcoming" || stage === "Due" || stage === "Grace" || stage === "Suspended" ? stage : "Manual";

    const recipient =
      body.channel === "Email" ? hospital.ownerEmail :
      body.channel === "Phone" || body.channel === "WhatsApp" ? hospital.ownerPhone :
      hospital.ownerName;
    const reminder = await BillingReminder.create({
      hospitalId,
      billingMonth: billingMonth || "trial",
      channel: body.channel,
      recipient,
      stage: reminderStage,
      message: body.message || defaultReminderMessage({
        hospitalName: hospital.name,
        stage,
        amount: subscription.monthlyPrice,
        dueDate: subscription.nextBillingDate,
        graceEndsAt: subscription.graceEndsAt,
      }),
      status: "Logged",
      sentBy: admin.email,
      sentAt: new Date(),
    });

    return successResponse(
      serializeDoc(reminder),
      body.channel === "In App"
        ? "In-app reminder logged"
        : `${body.channel} reminder logged. Connect a messaging provider to deliver it automatically.`,
      201,
    );
  } catch (error) {
    return handleApiError(error);
  }
}
