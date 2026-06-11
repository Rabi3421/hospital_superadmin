import { NextRequest } from "next/server";
import { handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { patientListPagination, requirePatientAuth } from "@/lib/hospital-patient";
import Appointment from "@/models/Appointment";
import HospitalAppointmentRequest from "@/models/HospitalAppointmentRequest";

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

    await connectDb();
    const [requests, total] = await Promise.all([
      HospitalAppointmentRequest.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      HospitalAppointmentRequest.countDocuments(filter),
    ]);
    const appointmentIds = requests.map((request) => request.appointmentId).filter((appointmentId): appointmentId is string => Boolean(appointmentId));
    const appointments = appointmentIds.length
      ? await Appointment.find({
          hospitalId: session.payload.hospitalId,
          patientId: session.patient.patientId,
          appointmentId: { $in: appointmentIds },
        }).select("appointmentId appointmentDate appointmentTime status tokenNumber doctorUserId departmentId")
      : [];
    const appointmentById = new Map(appointments.map((appointment) => [appointment.appointmentId, appointment]));

    return successResponse(
      serializeDoc(
        requests.map((request) => ({
          ...request.toObject(),
          linkedAppointment: request.appointmentId ? appointmentById.get(request.appointmentId) ?? null : null,
        })),
      ),
      "Patient appointment requests fetched",
      200,
      { page, limit, total, totalPages: Math.ceil(total / limit) },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
