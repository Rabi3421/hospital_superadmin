import { NextRequest } from "next/server";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import AppointmentSlot from "@/models/AppointmentSlot";

type RouteContext = { params: Promise<{ slotId: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "doctor_slots_cancel");
    const { slotId } = await context.params;
    const hospitalId = session.payload.hospitalId;
    await connectDb();

    const filter: Record<string, unknown> = { hospitalId, slotId };
    if (session.user.role === "DOCTOR") filter.doctorUserId = session.payload.userId;
    const slot = await AppointmentSlot.findOne(filter);
    if (!slot) return errorResponse("Slot not found", 404);

    if (slot.status === "Cancelled") {
      return errorResponse("Slot is already cancelled", 409);
    }
    if (slot.bookedCount > 0) {
      return errorResponse("Cannot cancel a slot that has bookings. Handle appointments first.", 409);
    }

    slot.status = "Cancelled";
    slot.updatedBy = session.payload.userId;
    await slot.save();

    return successResponse(serializeDoc(slot), "Slot cancelled");
  } catch (error) {
    return handleApiError(error);
  }
}
