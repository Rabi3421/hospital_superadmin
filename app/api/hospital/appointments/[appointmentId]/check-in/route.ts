import { NextRequest } from "next/server";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { assertTransition, loadAppointmentForHospital } from "@/lib/hospital-clinical";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import { sendEventNotification } from "@/lib/notifications/notification-service";
import Patient from "@/models/Patient";

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

    // Fire-and-forget notification
    try {
      const patient = await Patient.findOne({ hospitalId: session.payload.hospitalId, patientId: appointment.patientId }).select("name phone");
      if (patient?.phone) {
        void sendEventNotification({
          hospitalId: session.payload.hospitalId,
          eventType: "APPOINTMENT_CHECKED_IN",
          recipient: {
            type: "PATIENT",
            name: patient.name,
            phone: patient.phone,
            patientId: appointment.patientId,
          },
          context: {
            patientName: patient.name,
            tokenNumber: appointment.tokenNumber ?? "",
            hospitalName: session.hospital.name,
          },
          relatedIds: { appointmentId },
        }).catch(() => {});
      }
    } catch {}

    return successResponse(serializeDoc(appointment), "Appointment checked in");
  } catch (error) {
    return handleApiError(error);
  }
}
