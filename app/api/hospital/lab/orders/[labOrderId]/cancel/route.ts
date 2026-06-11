import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import LabOrder from "@/models/LabOrder";

const cancelSchema = z.object({ cancellationReason: z.string().optional() });
type RouteContext = { params: Promise<{ labOrderId: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "lab_orders_cancel");
    const { labOrderId } = await context.params;
    const body = cancelSchema.parse(await req.json().catch(() => ({})));
    await connectDb();
    const order = await LabOrder.findOne({ hospitalId: session.payload.hospitalId, labOrderId });
    if (!order) return errorResponse("Lab order not found", 404);
    if (!["Ordered", "Sample Collected"].includes(order.status)) {
      return errorResponse("Only ordered or sample collected lab orders can be cancelled", 409);
    }
    order.status = "Cancelled";
    order.tests = order.tests.map((test) => ({ ...test, status: "Cancelled" }));
    order.cancelledAt = new Date();
    order.cancellationReason = body.cancellationReason ?? "";
    await order.save();
    return successResponse(serializeDoc(order), "Lab order cancelled");
  } catch (error) {
    return handleApiError(error);
  }
}
