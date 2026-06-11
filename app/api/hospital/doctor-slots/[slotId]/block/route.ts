import { NextRequest } from "next/server";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import AppointmentSlot from "@/models/AppointmentSlot";

type RouteContext = { params: Promise<{ slotId: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "doctor_slots_block");
    if (session.user.role === "DOCTOR") {
      throw new Error("Forbidden: doctors cannot block slots");
    }
    const { slotId } = await context.params;
    const hospitalId = session.payload.hospitalId;
    await connectDb();

    const slot = await AppointmentSlot.findOne({ hospitalId, slotId });
    if (!slot) return errorResponse("Slot not found", 404);
    if (slot.status !== "Available") {
      return errorResponse(`Cannot block slot with status: ${slot.status}`, 409);
    }
    if (slot.bookedCount > 0) {
      return errorResponse("Cannot block a slot that has bookings", 409);
    }

    slot.status = "Blocked";
    slot.updatedBy = session.payload.userId;
    await slot.save();

    return successResponse(serializeDoc(slot), "Slot blocked");
  } catch (error) {
    return handleApiError(error);
  }
}
