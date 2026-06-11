import { NextRequest } from "next/server";
import { handleApiError, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { dateRangeFor } from "@/lib/hospital-clinical";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import Appointment from "@/models/Appointment";
import HospitalAppointmentRequest from "@/models/HospitalAppointmentRequest";
import Patient from "@/models/Patient";

export async function GET(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "reception_dashboard_view");
    const hospitalId = session.payload.hospitalId;
    const today = dateRangeFor(new Date());
    await connectDb();

    const [
      todayAppointments,
      checkedInToday,
      waitingToday,
      inConsultationToday,
      completedToday,
      cancelledToday,
      newPatientsToday,
      totalActivePatients,
      pendingOnlineAppointmentRequests,
    ] = await Promise.all([
      Appointment.countDocuments({ hospitalId, appointmentDate: today }),
      Appointment.countDocuments({ hospitalId, appointmentDate: today, status: "Checked In" }),
      Appointment.countDocuments({ hospitalId, appointmentDate: today, status: { $in: ["Scheduled", "Checked In"] } }),
      Appointment.countDocuments({ hospitalId, appointmentDate: today, status: "In Consultation" }),
      Appointment.countDocuments({ hospitalId, appointmentDate: today, status: "Completed" }),
      Appointment.countDocuments({ hospitalId, appointmentDate: today, status: "Cancelled" }),
      Patient.countDocuments({ hospitalId, createdAt: today }),
      Patient.countDocuments({ hospitalId, status: "Active" }),
      HospitalAppointmentRequest.countDocuments({ hospitalId, status: "New" }),
    ]);

    return successResponse({
      todayAppointments,
      checkedInToday,
      waitingToday,
      inConsultationToday,
      completedToday,
      cancelledToday,
      newPatientsToday,
      totalActivePatients,
      pendingOnlineAppointmentRequests,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
