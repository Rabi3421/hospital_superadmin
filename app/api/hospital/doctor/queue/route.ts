import { NextRequest } from "next/server";
import { handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { dateRangeFor } from "@/lib/hospital-clinical";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import Appointment from "@/models/Appointment";
import AppointmentSlot from "@/models/AppointmentSlot";
import Consultation from "@/models/Consultation";
import HospitalDepartment from "@/models/HospitalDepartment";
import Patient from "@/models/Patient";

export async function GET(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "doctor_queue_view");
    const hospitalId = session.payload.hospitalId;
    const date = req.nextUrl.searchParams.get("date") ?? new Date();
    const filter: Record<string, unknown> = {
      hospitalId,
      appointmentDate: dateRangeFor(date),
      status: req.nextUrl.searchParams.get("status")?.trim() || {
        $in: ["Scheduled", "Checked In", "In Consultation"],
      },
    };

    if (session.user.role === "DOCTOR") {
      filter.doctorUserId = session.payload.userId;
    } else {
      const doctorUserId = req.nextUrl.searchParams.get("doctorUserId")?.trim();
      if (doctorUserId) filter.doctorUserId = doctorUserId;
    }

    await connectDb();
    const appointments = await Appointment.find(filter).sort({ scheduledStartTime: 1, tokenNumber: 1, createdAt: 1 });

    const patientIds = [...new Set(appointments.map((a) => a.patientId).filter(Boolean))];
    const departmentIds = [
      ...new Set(
        appointments.map((a) => a.departmentId).filter((id): id is string => Boolean(id)),
      ),
    ];
    const appointmentIds = appointments.map((a) => a.appointmentId);
    const slotIds = [
      ...new Set(appointments.map((a) => a.slotId).filter((id): id is string => Boolean(id))),
    ];

    const [patients, departments, consultations, slots] = await Promise.all([
      Patient.find({ hospitalId, patientId: { $in: patientIds } }).select(
        "patientId name phone email gender age bloodGroup allergies currentMedications medicalHistory status",
      ),
      HospitalDepartment.find({ hospitalId, _id: { $in: departmentIds } }).select("name status"),
      Consultation.find({ hospitalId, appointmentId: { $in: appointmentIds } }).select(
        "consultationId appointmentId status",
      ),
      AppointmentSlot.find({ hospitalId, slotId: { $in: slotIds } }).select(
        "slotId date startTime endTime durationMinutes status bookedCount maxBookings",
      ),
    ]);

    const patientById = new Map(patients.map((p) => [p.patientId, p]));
    const departmentById = new Map(departments.map((d) => [d._id.toString(), d]));
    const consultationByApptId = new Map(consultations.map((c) => [c.appointmentId, c]));
    const slotBySlotId = new Map(slots.map((s) => [s.slotId, s]));

    const queue = appointments.map((a) => ({
      appointmentId: a.appointmentId,
      appointmentDate: a.appointmentDate,
      tokenNumber: a.tokenNumber,
      queueNumber: a.queueNumber ?? null,
      status: a.status,
      type: a.type,
      source: a.source,
      scheduledStartTime: a.scheduledStartTime,
      scheduledEndTime: a.scheduledEndTime,
      appointmentTime: a.appointmentTime,
      checkedInAt: a.checkedInAt,
      consultationStartedAt: a.consultationStartedAt,
      slotId: a.slotId ?? null,
      availabilityId: a.availabilityId ?? null,
      reason: a.reason,
      notes: a.notes,
      patient: patientById.get(a.patientId) ?? null,
      department: a.departmentId ? departmentById.get(a.departmentId) ?? null : null,
      slot: a.slotId ? slotBySlotId.get(a.slotId) ?? null : null,
      consultation: consultationByApptId.get(a.appointmentId) ?? null,
    }));

    return successResponse(serializeDoc(queue), "Doctor queue fetched");
  } catch (error) {
    return handleApiError(error);
  }
}
