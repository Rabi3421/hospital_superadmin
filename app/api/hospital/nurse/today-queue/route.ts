import { NextRequest } from "next/server";
import { handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { dateRangeFor, getPagination } from "@/lib/hospital-clinical";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import Appointment from "@/models/Appointment";
import Patient from "@/models/Patient";
import PatientVitalRecord from "@/models/PatientVitalRecord";

export async function GET(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "nurse_today_queue_view");
    const hospitalId = session.payload.hospitalId;
    const { page, limit, skip } = getPagination(req.nextUrl.searchParams);
    await connectDb();

    const dateParam = req.nextUrl.searchParams.get("date");
    const dateRange = dateParam ? dateRangeFor(dateParam) : dateRangeFor(new Date());

    const filter: Record<string, unknown> = {
      hospitalId,
      appointmentDate: dateRange,
    };

    const doctorUserId = req.nextUrl.searchParams.get("doctorUserId")?.trim();
    if (doctorUserId) filter.doctorUserId = doctorUserId;

    const departmentId = req.nextUrl.searchParams.get("departmentId")?.trim();
    if (departmentId) filter.departmentId = departmentId;

    const status = req.nextUrl.searchParams.get("status")?.trim();
    if (status) filter.status = status;

    const triageStatus = req.nextUrl.searchParams.get("triageStatus")?.trim();
    if (triageStatus) filter.triageStatus = triageStatus;

    const triagePriority = req.nextUrl.searchParams.get("triagePriority")?.trim();
    if (triagePriority) filter.triagePriority = triagePriority;

    const [appointments, total] = await Promise.all([
      Appointment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Appointment.countDocuments(filter),
    ]);

    const patientIds = [...new Set(appointments.map((a) => a.patientId))];
    const appointmentIds = appointments.map((a) => a.appointmentId);

    const [patients, vitals] = await Promise.all([
      Patient.find({ hospitalId, patientId: { $in: patientIds } }).select("patientId name phone gender age status"),
      PatientVitalRecord.find({ hospitalId, appointmentId: { $in: appointmentIds } })
        .sort({ recordedAt: -1 }),
    ]);

    const patientMap = new Map(patients.map((p) => [p.patientId, p]));
    const latestVitalByAppointment = new Map<string, typeof vitals[0]>();
    for (const vital of vitals) {
      const aptId = vital.appointmentId;
      if (aptId && !latestVitalByAppointment.has(aptId)) {
        latestVitalByAppointment.set(aptId, vital);
      }
    }

    const enriched = appointments.map((apt) => ({
      ...apt.toObject(),
      patient: patientMap.get(apt.patientId) ? serializeDoc(patientMap.get(apt.patientId)) : null,
      latestVitals: latestVitalByAppointment.has(apt.appointmentId)
        ? serializeDoc(latestVitalByAppointment.get(apt.appointmentId))
        : null,
    }));

    return successResponse(serializeDoc(enriched), "Today queue fetched", 200, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
