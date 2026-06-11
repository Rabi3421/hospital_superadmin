import { NextRequest } from "next/server";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { assertTransition, loadAppointmentForHospital } from "@/lib/hospital-clinical";
import { requireHospitalPermission } from "@/lib/hospital-auth";

type RouteContext = { params: Promise<{ appointmentId: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "appointments_start_consultation");
    const { appointmentId } = await context.params;
    await connectDb();

    const appointment = await loadAppointmentForHospital(session.payload.hospitalId, appointmentId);
    if (!appointment) return errorResponse("Appointment not found", 404);
    if (session.user.role === "DOCTOR" && appointment.doctorUserId !== session.payload.userId) {
      return errorResponse("Forbidden: doctors can only start their assigned appointments", 403);
    }

    assertTransition(appointment, ["Scheduled", "Checked In"], "In Consultation");
    appointment.status = "In Consultation";
    appointment.consultationStartedAt = new Date();
    await appointment.save();

    return successResponse(serializeDoc(appointment), "Consultation started");
  } catch (error) {
    return handleApiError(error);
  }
}
