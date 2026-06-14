import { NextRequest } from "next/server";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import AppointmentSlot from "@/models/AppointmentSlot";

type RouteContext = { params: Promise<{ slotId: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "doctor_slots_block");
    const { slotId } = await context.params;
    const hospitalId = session.payload.hospitalId;
    await connectDb();

    const filter: Record<string, unknown> = { hospitalId, slotId };
    if (session.user.role === "DOCTOR") filter.doctorUserId = session.payload.userId;
    const slot = await AppointmentSlot.findOne(filter);
    if (!slot) return errorResponse("Slot not found", 404);
    if (slot.status !== "Blocked") {
      return errorResponse("Only Blocked slots can be unblocked", 409);
    }

    slot.status = "Available";
    slot.updatedBy = session.payload.userId;
    await slot.save();

    return successResponse(serializeDoc(slot), "Slot unblocked");
  } catch (error) {
    return handleApiError(error);
  }
}
