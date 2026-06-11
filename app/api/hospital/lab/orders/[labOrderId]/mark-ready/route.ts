import { NextRequest } from "next/server";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import LabOrder from "@/models/LabOrder";

type RouteContext = { params: Promise<{ labOrderId: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "lab_orders_mark_ready");
    const { labOrderId } = await context.params;
    await connectDb();
    const order = await LabOrder.findOne({ hospitalId: session.payload.hospitalId, labOrderId });
    if (!order) return errorResponse("Lab order not found", 404);
    if (order.status !== "Processing") {
      return errorResponse("Lab order cannot move to ready from current status", 409);
    }
    order.status = "Ready";
    order.tests = order.tests.map((test) => ({ ...test, status: "Ready" }));
    order.readyAt = new Date();
    await order.save();
    return successResponse(serializeDoc(order), "Lab order marked ready");
  } catch (error) {
    return handleApiError(error);
  }
}
