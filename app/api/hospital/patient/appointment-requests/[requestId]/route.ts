import { NextRequest } from "next/server";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requirePatientAuth } from "@/lib/hospital-patient";
import Appointment from "@/models/Appointment";
import HospitalAppointmentRequest from "@/models/HospitalAppointmentRequest";

type RouteContext = { params: Promise<{ requestId: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const session = await requirePatientAuth(req);
    const { requestId } = await context.params;
    await connectDb();
    const request = await HospitalAppointmentRequest.findOne({
      _id: requestId,
      hospitalId: session.payload.hospitalId,
      patientId: session.patient.patientId,
    });
    if (!request) return errorResponse("Appointment request not found", 404);

    const linkedAppointment = request.appointmentId
      ? await Appointment.findOne({
          hospitalId: session.payload.hospitalId,
          patientId: session.patient.patientId,
          appointmentId: request.appointmentId,
        }).select("appointmentId appointmentDate appointmentTime status tokenNumber doctorUserId departmentId")
      : null;

    return successResponse(
      serializeDoc({
        ...request.toObject(),
        linkedAppointment,
      }),
      "Patient appointment request fetched",
    );
  } catch (error) {
    return handleApiError(error);
  }
}
