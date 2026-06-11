import { NextRequest } from "next/server";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { assertDoctorOwnsRecord } from "@/lib/hospital-clinical";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import Appointment from "@/models/Appointment";
import Consultation from "@/models/Consultation";

type RouteContext = { params: Promise<{ consultationId: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "consultations_complete");
    const { consultationId } = await context.params;
    await connectDb();

    const consultation = await Consultation.findOne({ hospitalId: session.payload.hospitalId, consultationId });
    if (!consultation) return errorResponse("Consultation not found", 404);
    assertDoctorOwnsRecord(session.user.role, session.payload.userId, consultation.doctorUserId);
    if (consultation.status !== "Draft") return errorResponse("Only draft consultations can be completed", 409);
    if (!consultation.chiefComplaint?.trim()) {
      return errorResponse("Add the chief complaint before completing the consultation", 400);
    }
    if (!consultation.diagnosis?.trim()) {
      return errorResponse("Add a diagnosis before completing the consultation", 400);
    }

    consultation.status = "Completed";
    consultation.completedAt = new Date();
    await consultation.save();

    const appointment = await Appointment.findOne({
      hospitalId: session.payload.hospitalId,
      appointmentId: consultation.appointmentId,
    });
    if (appointment && appointment.status !== "Completed") {
      appointment.status = "Completed";
      appointment.completedAt = appointment.completedAt ?? new Date();
      await appointment.save();
    }

    return successResponse(serializeDoc(consultation), "Consultation completed");
  } catch (error) {
    return handleApiError(error);
  }
}
