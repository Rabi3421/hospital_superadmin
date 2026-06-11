import { NextRequest } from "next/server";
import { handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { applyAppointmentDateFilters, doctorMapFor, patientListPagination, requirePatientAuth } from "@/lib/hospital-patient";
import Appointment from "@/models/Appointment";
import HospitalDepartment from "@/models/HospitalDepartment";

export async function GET(req: NextRequest) {
  try {
    const session = await requirePatientAuth(req);
    const { page, limit, skip } = patientListPagination(req.nextUrl.searchParams);
    const filter: Record<string, unknown> = {
      hospitalId: session.payload.hospitalId,
      patientId: session.patient.patientId,
    };
    const status = req.nextUrl.searchParams.get("status")?.trim();
    if (status) filter.status = status;
    applyAppointmentDateFilters(filter, req.nextUrl.searchParams);
    await connectDb();

    const [appointments, total] = await Promise.all([
      Appointment.find(filter).sort({ appointmentDate: -1, tokenNumber: 1, createdAt: -1 }).skip(skip).limit(limit),
      Appointment.countDocuments(filter),
    ]);
    const doctorById = await doctorMapFor(session.payload.hospitalId, appointments.map((appointment) => appointment.doctorUserId ?? ""));
    const departmentIds = appointments
      .map((appointment) => appointment.departmentId)
      .filter((departmentId): departmentId is string => Boolean(departmentId));
    const departments = await HospitalDepartment.find({
      hospitalId: session.payload.hospitalId,
      _id: { $in: departmentIds },
    }).select("name description icon status");
    const departmentById = new Map(departments.map((department) => [department._id.toString(), department]));

    return successResponse(
      serializeDoc(appointments.map((appointment) => ({
        ...appointment.toObject(),
        doctor: appointment.doctorUserId ? doctorById.get(appointment.doctorUserId) ?? null : null,
        department: appointment.departmentId ? departmentById.get(appointment.departmentId) ?? null : null,
      }))),
      "Patient appointments fetched",
      200,
      { page, limit, total, totalPages: Math.ceil(total / limit) },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
