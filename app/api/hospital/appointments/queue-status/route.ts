import { NextRequest } from "next/server";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { dateRangeFor } from "@/lib/hospital-clinical";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import Appointment, { type AppointmentStatus } from "@/models/Appointment";
import HospitalDepartment from "@/models/HospitalDepartment";
import HospitalUser from "@/models/HospitalUser";
import Patient from "@/models/Patient";

export async function GET(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "appointment_queue_tracking_view");
    const hospitalId = session.payload.hospitalId;
    await connectDb();

    const dateParam = req.nextUrl.searchParams.get("date")?.trim();
    if (!dateParam) return errorResponse("date parameter is required (YYYY-MM-DD)", 422);

    const excludedStatuses: AppointmentStatus[] = ["Cancelled", "No Show"];
    const filter: Record<string, unknown> = {
      hospitalId,
      appointmentDate: dateRangeFor(dateParam),
      status: { $nin: excludedStatuses },
    };

    if (session.user.role === "DOCTOR") {
      filter.doctorUserId = session.payload.userId;
    } else {
      const doctorUserId = req.nextUrl.searchParams.get("doctorUserId")?.trim();
      if (doctorUserId) filter.doctorUserId = doctorUserId;
    }

    const appointments = await Appointment.find(filter).sort({ scheduledStartTime: 1, tokenNumber: 1 });

    const [scheduled, checkedIn, inConsultation, completed] = [
      appointments.filter((a) => a.status === "Scheduled").length,
      appointments.filter((a) => a.status === "Checked In").length,
      appointments.filter((a) => a.status === "In Consultation").length,
      appointments.filter((a) => a.status === "Completed").length,
    ];

    const currentServing = appointments.find((a) => a.status === "In Consultation");

    const patientIds = [...new Set(appointments.map((a) => a.patientId).filter((id): id is string => Boolean(id)))];
    const doctorIds = [...new Set(appointments.map((a) => a.doctorUserId).filter((id): id is string => Boolean(id)))];
    const departmentIds = [
      ...new Set(
        appointments.map((a) => a.departmentId).filter((id): id is string => Boolean(id)),
      ),
    ];

    const [patients, doctors, departments] = await Promise.all([
      Patient.find({ hospitalId, patientId: { $in: patientIds } }).select("patientId name phone gender age"),
      HospitalUser.find({ hospitalId, _id: { $in: doctorIds } }).select("name role"),
      HospitalDepartment.find({ hospitalId, _id: { $in: departmentIds } }).select("name"),
    ]);

    const patientById = new Map(patients.map((p) => [p.patientId, p]));
    const doctorById = new Map(doctors.map((d) => [d._id.toString(), d]));
    const departmentById = new Map(departments.map((d) => [d._id.toString(), d]));

    const queue = appointments.map((a) => ({
      appointmentId: a.appointmentId,
      tokenNumber: a.tokenNumber,
      queueNumber: a.queueNumber,
      status: a.status,
      scheduledStartTime: a.scheduledStartTime,
      scheduledEndTime: a.scheduledEndTime,
      appointmentTime: a.appointmentTime,
      slotId: a.slotId,
      reason: a.reason,
      patient: patientById.get(a.patientId) ?? null,
      doctor: a.doctorUserId ? doctorById.get(a.doctorUserId) ?? null : null,
      department: a.departmentId ? departmentById.get(a.departmentId) ?? null : null,
    }));

    return successResponse(
      serializeDoc({
        date: dateParam,
        summary: {
          total: appointments.length,
          scheduled,
          checkedIn,
          inConsultation,
          completed,
          waiting: scheduled + checkedIn,
        },
        currentServing: currentServing
          ? {
              appointmentId: currentServing.appointmentId,
              tokenNumber: currentServing.tokenNumber,
            }
          : null,
        queue,
      }),
      "Staff queue status fetched",
    );
  } catch (error) {
    return handleApiError(error);
  }
}
