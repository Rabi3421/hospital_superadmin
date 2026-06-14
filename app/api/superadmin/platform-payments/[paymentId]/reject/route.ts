import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { getSuperAdminFromRequest } from "@/lib/superadmin-auth";
import PlatformPayment from "@/models/PlatformPayment";

const rejectSchema = z.object({ reason: z.string().trim().min(3).max(500) });
type RouteContext = { params: Promise<{ paymentId: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const admin = await getSuperAdminFromRequest(req);
    if (!admin) return errorResponse("Unauthorized", 401);
    const { reason } = rejectSchema.parse(await req.json());
    await connectDb();
    const { paymentId } = await context.params;
    const payment = await PlatformPayment.findOne({ _id: paymentId, status: "Pending" });
    if (!payment) return errorResponse("Pending payment not found", 404);
    payment.status = "Failed";
    payment.reviewedBy = admin.email;
    payment.reviewedAt = new Date();
    payment.rejectionReason = reason;
    payment.notes = [payment.notes, `Rejected by ${admin.email}: ${reason}`].filter(Boolean).join("\n");
    await payment.save();
    return successResponse(serializeDoc(payment), "Payment submission rejected");
  } catch (error) {
    return handleApiError(error);
  }
}
