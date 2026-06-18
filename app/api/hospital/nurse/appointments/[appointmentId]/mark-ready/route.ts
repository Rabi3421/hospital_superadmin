import { NextRequest } from "next/server";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import { sendEventNotification } from "@/lib/notifications/notification-service";
import Appointment from "@/models/Appointment";
import Patient from "@/models/Patient";

type RouteContext = { params: Promise<{ appointmentId: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "nurse_mark_patient_ready");
    const { appointmentId } = await context.params;
    const hospitalId = session.payload.hospitalId;
    await connectDb();

    const appointment = await Appointment.findOne({ hospitalId, appointmentId });
    if (!appointment) return errorResponse("Appointment not found", 404);

    const activeStatuses = ["Scheduled", "Checked In", "In Consultation"];
    if (!activeStatuses.includes(appointment.status)) {
      return errorResponse("Appointment is not in an active status", 409);
    }

    appointment.triageStatus = "Ready For Doctor";
    appointment.nurseReadyAt = new Date();
    await appointment.save();

    // Fire-and-forget notification
    try {
      const patient = await Patient.findOne({ hospitalId, patientId: appointment.patientId }).select("name phone");
      if (patient?.phone) {
        void sendEventNotification({
          hospitalId,
          eventType: "PATIENT_READY_FOR_DOCTOR",
          recipient: {
            type: "PATIENT",
            name: patient.name,
            phone: patient.phone,
            patientId: appointment.patientId,
          },
          context: {
            patientName: patient.name,
            hospitalName: session.hospital.name,
          },
          relatedIds: { appointmentId },
        }).catch(() => {});
      }
    } catch {}

    return successResponse(serializeDoc(appointment), "Patient marked ready for doctor");
  } catch (error) {
    return handleApiError(error);
  }
}
