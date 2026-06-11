import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import AppointmentSlot from "@/models/AppointmentSlot";
import Appointment from "@/models/Appointment";
import Patient from "@/models/Patient";

type RouteContext = { params: Promise<{ slotId: string }> };

const patchSchema = z.object({
  room: z.string().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "doctor_slots_view");
    const { slotId } = await context.params;
    const hospitalId = session.payload.hospitalId;
    await connectDb();

    const filter: Record<string, unknown> = { hospitalId, slotId };
    if (session.user.role === "DOCTOR") {
      filter.doctorUserId = session.payload.userId;
    }

    const slot = await AppointmentSlot.findOne(filter);
    if (!slot) return errorResponse("Slot not found", 404);

    // Enrich with appointments for booked slots
    let appointments = null;
    if (slot.bookedCount > 0 && slot.appointmentIds.length > 0) {
      const appts = await Appointment.find({
        hospitalId,
        appointmentId: { $in: slot.appointmentIds },
      }).select("appointmentId patientId tokenNumber status scheduledStartTime scheduledEndTime reason");

      const patientIds = appts.map((a) => a.patientId).filter(Boolean);
      const patients = await Patient.find({ hospitalId, patientId: { $in: patientIds } }).select(
        "patientId name phone gender age",
      );
      const patientById = new Map(patients.map((p) => [p.patientId, p]));

      appointments = appts.map((a) => ({
        ...a.toObject(),
        patient: patientById.get(a.patientId) ?? null,
      }));
    }

    return successResponse(serializeDoc({ ...slot.toObject(), appointments }), "Slot fetched");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "doctor_slots_update");
    if (session.user.role === "DOCTOR") {
      throw new Error("Forbidden: doctors cannot update slots");
    }
    const { slotId } = await context.params;
    const hospitalId = session.payload.hospitalId;
    const body = patchSchema.parse(await req.json());
    await connectDb();

    const slot = await AppointmentSlot.findOne({ hospitalId, slotId });
    if (!slot) return errorResponse("Slot not found", 404);
    if (slot.status === "Cancelled") return errorResponse("Cannot update cancelled slot", 409);

    if (body.room !== undefined) slot.room = body.room;
    if (body.location !== undefined) slot.location = body.location;
    if (body.notes !== undefined) slot.notes = body.notes;
    slot.updatedBy = session.payload.userId;
    await slot.save();

    return successResponse(serializeDoc(slot), "Slot updated");
  } catch (error) {
    return handleApiError(error);
  }
}
