import { NextRequest } from "next/server";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requirePatientAuth } from "@/lib/hospital-patient";
import Appointment, { type AppointmentStatus } from "@/models/Appointment";
import HospitalUser from "@/models/HospitalUser";

type RouteContext = { params: Promise<{ appointmentId: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const session = await requirePatientAuth(req);
    const { appointmentId } = await context.params;
    const hospitalId = session.payload.hospitalId;
    const patientId = session.patient.patientId;
    await connectDb();

    // Fetch own appointment only
    const appointment = await Appointment.findOne({ hospitalId, appointmentId, patientId });
    if (!appointment) return errorResponse("Appointment not found", 404);

    const dateStr = appointment.appointmentDate.toISOString().split("T")[0];
    const doctorUserId = appointment.doctorUserId;

    // Appointments for same doctor/date (excluding cancelled/no-show)
    const excludedStatuses: AppointmentStatus[] = ["Cancelled", "No Show"];
    const dayFilter: Record<string, unknown> = {
      hospitalId,
      doctorUserId,
      appointmentDate: {
        $gte: new Date(`${dateStr}T00:00:00`),
        $lte: new Date(`${dateStr}T23:59:59`),
      },
      status: { $nin: excludedStatuses },
    };

    const allAppts = await Appointment.find(dayFilter)
      .select("appointmentId tokenNumber scheduledStartTime status patientId")
      .sort({ scheduledStartTime: 1, tokenNumber: 1 });

    const myIndex = allAppts.findIndex((a) => a.appointmentId === appointmentId);

    // Patients before me: earlier token/time and active
    const activeStatuses = ["Scheduled", "Checked In", "In Consultation"];
    const apptsBefore = allAppts.slice(0, myIndex);
    const totalScheduledBefore = apptsBefore.filter((a) => a.status === "Scheduled").length;
    const totalCheckedInBefore = apptsBefore.filter((a) => a.status === "Checked In").length;
    const totalInConsultation = allAppts.filter((a) => a.status === "In Consultation").length;
    const totalCompletedBefore = allAppts.slice(0, myIndex).filter((a) => a.status === "Completed").length;

    const activePatientsBefore = apptsBefore.filter((a) => activeStatuses.includes(a.status)).length;

    // Current serving token
    const currentServing = allAppts.find((a) => a.status === "In Consultation");
    const currentServingToken = currentServing?.tokenNumber ?? null;

    // My queue position (active appointments before me + 1)
    const myPosition = ["Completed", "Cancelled", "No Show"].includes(appointment.status)
      ? null
      : activePatientsBefore + 1;

    // Average consultation minutes: use estimatedConsultationMinutes or slot duration
    const avgMinutes = appointment.estimatedConsultationMinutes || 30;
    const estimatedWaitMinutes =
      myPosition !== null && !["Completed", "Cancelled", "No Show"].includes(appointment.status)
        ? activePatientsBefore * avgMinutes
        : null;

    // Safe doctor info (no personal fields)
    let doctor = null;
    if (doctorUserId) {
      const doc = await HospitalUser.findOne({ hospitalId, _id: doctorUserId, role: "DOCTOR" }).select("name");
      if (doc) doctor = { name: doc.name };
    }

    return successResponse(
      serializeDoc({
        appointmentId: appointment.appointmentId,
        tokenNumber: appointment.tokenNumber,
        queueNumber: appointment.queueNumber ?? null,
        status: appointment.status,
        appointmentDate: appointment.appointmentDate,
        appointmentTime: appointment.appointmentTime,
        scheduledStartTime: appointment.scheduledStartTime,
        scheduledEndTime: appointment.scheduledEndTime,
        doctor,
        slotId: appointment.slotId ?? null,
        queue: {
          totalScheduledBefore,
          totalCheckedInBefore,
          totalInConsultation,
          totalCompletedBefore,
          currentServingToken,
          myPosition,
          estimatedWaitMinutes,
          averageConsultationMinutes: avgMinutes,
        },
      }),
      "Queue status fetched",
    );
  } catch (error) {
    return handleApiError(error);
  }
}
