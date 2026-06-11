import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { getSuperAdminFromRequest } from "@/lib/superadmin-auth";
import Hospital from "@/models/Hospital";
import PlatformPayment from "@/models/PlatformPayment";

const paymentUpdateSchema = z.object({
  hospitalId: z.string().min(1).optional(),
  amount: z.coerce.number().positive().optional(),
  paymentDate: z.coerce.date().optional(),
  paymentMode: z.enum(["Cash", "UPI", "Bank Transfer", "Card", "Online"]).optional(),
  transactionId: z.string().optional(),
  billingMonth: z.string().min(1).optional(),
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
    if (body.hospitalId) {
      const hospital = await Hospital.findOne({ hospitalId: body.hospitalId });
      if (!hospital) return errorResponse("Hospital not found", 404);
    }

    const { paymentId } = await context.params;
    const payment = await PlatformPayment.findByIdAndUpdate(paymentId, body, { new: true, runValidators: true });
    if (!payment) return errorResponse("Payment not found", 404);

    return successResponse(serializeDoc(payment), "Payment updated");
  } catch (error) {
    return handleApiError(error);
  }
}
