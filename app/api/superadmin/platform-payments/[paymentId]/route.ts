import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { getSuperAdminFromRequest } from "@/lib/superadmin-auth";
import { billingDueDateForMonth, reconcileSubscriptionBilling } from "@/lib/subscription-billing";
import Hospital from "@/models/Hospital";
import PlatformPayment from "@/models/PlatformPayment";
import Subscription from "@/models/Subscription";

const paymentUpdateSchema = z.object({
  hospitalId: z.string().min(1).optional(),
  amount: z.coerce.number().positive().optional(),
  paymentDate: z.coerce.date().optional(),
  paymentMode: z.enum(["Cash", "UPI", "Bank Transfer", "Card", "Online"]).optional(),
  transactionId: z.string().optional(),
  billingMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Billing month must use YYYY-MM format").optional(),
  status: z.enum(["Paid", "Pending", "Failed", "Refunded"]).optional(),
  notes: z.string().optional(),
});

type RouteContext = { params: Promise<{ paymentId: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const admin = await getSuperAdminFromRequest(req);
    if (!admin) return errorResponse("Unauthorized", 401);

    await connectDb();
    const { paymentId } = await context.params;
    const payment = await PlatformPayment.findById(paymentId);
    if (!payment) return errorResponse("Payment not found", 404);
    return successResponse(serializeDoc(payment));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const admin = await getSuperAdminFromRequest(req);
    if (!admin) return errorResponse("Unauthorized", 401);

    const body = paymentUpdateSchema.parse(await req.json());
    await connectDb();
    const { paymentId } = await context.params;
    const existingPayment = await PlatformPayment.findById(paymentId);
    if (!existingPayment) return errorResponse("Payment not found", 404);

    const hospitalId = body.hospitalId ?? existingPayment.hospitalId;
    if (body.hospitalId) {
      const hospital = await Hospital.findOne({ hospitalId });
      if (!hospital) return errorResponse("Hospital not found", 404);
    }
    const resultingStatus = body.status ?? existingPayment.status;
    const resultingAmount = body.amount ?? existingPayment.amount;
    const billingMonth = body.billingMonth ?? existingPayment.billingMonth;
    if (resultingStatus === "Paid") {
      const subscription = await Subscription.findOne({ hospitalId });
      if (!subscription) return errorResponse("Subscription not found", 404);
      if (resultingAmount < subscription.monthlyPrice) {
        return errorResponse(`Paid amount must cover the agreed monthly price of ₹${subscription.monthlyPrice}`, 422);
      }
      const existingPaidPayment = await PlatformPayment.exists({
        _id: { $ne: existingPayment._id },
        hospitalId,
        billingMonth,
        status: "Paid",
      });
      if (existingPaidPayment) {
        return errorResponse("A paid payment already exists for this hospital and billing month", 409);
      }
    }

    const payment = await PlatformPayment.findByIdAndUpdate(paymentId, body, { new: true, runValidators: true });
    if (!payment) return errorResponse("Payment not found", 404);

    const oldPaidPeriodChanged =
      existingPayment.status === "Paid" &&
      (resultingStatus !== "Paid" || hospitalId !== existingPayment.hospitalId || billingMonth !== existingPayment.billingMonth);
    if (oldPaidPeriodChanged) {
      const oldDueDate = billingDueDateForMonth(existingPayment.billingMonth);
      await Subscription.updateOne(
        {
          hospitalId: existingPayment.hospitalId,
          $or: [{ nextBillingDate: { $gt: oldDueDate } }, { nextBillingDate: { $exists: false } }],
        },
        {
          $set: { nextBillingDate: oldDueDate },
          $unset: { lastPaidBillingMonth: 1 },
        },
      );
    }
    await reconcileSubscriptionBilling(existingPayment.hospitalId);
    if (hospitalId !== existingPayment.hospitalId) {
      await reconcileSubscriptionBilling(hospitalId);
    }
    return successResponse(serializeDoc(payment), "Payment updated");
  } catch (error) {
    return handleApiError(error);
  }
}
