import { NextRequest } from "next/server";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { assertTransition, loadAppointmentForHospital } from "@/lib/hospital-clinical";
import { requireHospitalPermission } from "@/lib/hospital-auth";

type RouteContext = { params: Promise<{ appointmentId: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "appointments_check_in");
    const { appointmentId } = await context.params;
    await connectDb();

    const appointment = await loadAppointmentForHospital(session.payload.hospitalId, appointmentId);
    if (!appointment) return errorResponse("Appointment not found", 404);

    assertTransition(appointment, ["Scheduled"], "Checked In");
    appointment.status = "Checked In";
    appointment.checkedInAt = new Date();
    await appointment.save();

    return successResponse(serializeDoc(appointment), "Appointment checked in");
  } catch (error) {
    return handleApiError(error);
  }
}
