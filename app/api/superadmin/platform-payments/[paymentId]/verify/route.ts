import { NextRequest } from "next/server";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { getSuperAdminFromRequest } from "@/lib/superadmin-auth";
import { reconcileSubscriptionBilling } from "@/lib/subscription-billing";
import PlatformPayment from "@/models/PlatformPayment";
import Subscription from "@/models/Subscription";

type RouteContext = { params: Promise<{ paymentId: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const admin = await getSuperAdminFromRequest(req);
    if (!admin) return errorResponse("Unauthorized", 401);
    await connectDb();
    const { paymentId } = await context.params;
    const payment = await PlatformPayment.findById(paymentId);
    if (!payment) return errorResponse("Payment not found", 404);
    if (payment.status !== "Pending") return errorResponse("Only pending payments can be verified", 409);

    const subscription = await Subscription.findOne({ hospitalId: payment.hospitalId });
    if (!subscription) return errorResponse("Subscription not found", 404);
    if (payment.amount < subscription.monthlyPrice) {
      return errorResponse(`Payment must cover the agreed monthly price of ₹${subscription.monthlyPrice}`, 422);
    }
    const duplicate = await PlatformPayment.exists({
      _id: { $ne: payment._id },
      hospitalId: payment.hospitalId,
      billingMonth: payment.billingMonth,
      status: "Paid",
    });
    if (duplicate) return errorResponse("A verified payment already exists for this billing month", 409);

    payment.status = "Paid";
    payment.reviewedBy = admin.email;
    payment.reviewedAt = new Date();
    payment.rejectionReason = "";
    payment.notes = [payment.notes, `Verified by ${admin.email} on ${new Date().toISOString()}`].filter(Boolean).join("\n");
    await payment.save();
    await reconcileSubscriptionBilling(payment.hospitalId);
    return successResponse(serializeDoc(payment), "Payment verified and subscription reconciled");
  } catch (error) {
    return handleApiError(error);
  }
}
