import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import Bill from "@/models/Bill";
import BillPayment from "@/models/BillPayment";

const cancelSchema = z.object({
  cancellationReason: z.string().optional(),
});

type RouteContext = { params: Promise<{ billId: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "billing_cancel");
    const { billId } = await context.params;
    const body = cancelSchema.parse(await req.json().catch(() => ({})));
    await connectDb();

    const bill = await Bill.findOne({ hospitalId: session.payload.hospitalId, billId });
    if (!bill) return errorResponse("Bill not found", 404);
    if (bill.status === "Cancelled") return errorResponse("Bill is already cancelled", 409);
    if (!["Draft", "Unpaid"].includes(bill.status)) {
      return errorResponse("Bill cannot be cancelled from current status", 409);
    }
    const successfulPayments = await BillPayment.countDocuments({
      hospitalId: session.payload.hospitalId,
      billId: bill.billId,
      status: "Success",
    });
    if (successfulPayments > 0) return errorResponse("Bills with successful payments cannot be cancelled", 409);

    bill.status = "Cancelled";
    bill.cancelledAt = new Date();
    bill.cancellationReason = body.cancellationReason ?? "";
    await bill.save();

    return successResponse(serializeDoc(bill), "Bill cancelled");
  } catch (error) {
    return handleApiError(error);
  }
}
