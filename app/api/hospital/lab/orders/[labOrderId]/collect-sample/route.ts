import { NextRequest } from "next/server";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import LabOrder from "@/models/LabOrder";

type RouteContext = { params: Promise<{ labOrderId: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "lab_orders_collect_sample");
    const { labOrderId } = await context.params;
    await connectDb();
    const order = await LabOrder.findOne({ hospitalId: session.payload.hospitalId, labOrderId });
    if (!order) return errorResponse("Lab order not found", 404);
    if (order.status !== "Ordered") return errorResponse("Only ordered lab orders can move to sample collected", 409);
    order.status = "Sample Collected";
    order.tests = order.tests.map((test) => ({ ...test, status: "Sample Collected" }));
    order.sampleCollectedAt = new Date();
    await order.save();
    return successResponse(serializeDoc(order), "Sample collected");
  } catch (error) {
    return handleApiError(error);
  }
}
