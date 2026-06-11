import { NextRequest } from "next/server";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { doctorMapFor, requirePatientAuth } from "@/lib/hospital-patient";
import Appointment from "@/models/Appointment";
import Consultation from "@/models/Consultation";
import HospitalDepartment from "@/models/HospitalDepartment";
import Prescription from "@/models/Prescription";

type RouteContext = { params: Promise<{ appointmentId: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const session = await requirePatientAuth(req);
    const { appointmentId } = await context.params;
    await connectDb();
    const appointment = await Appointment.findOne({
      hospitalId: session.payload.hospitalId,
      patientId: session.patient.patientId,
      appointmentId,
    });
    if (!appointment) return errorResponse("Appointment not found", 404);

    const [doctorById, department, consultation, prescription] = await Promise.all([
      doctorMapFor(session.payload.hospitalId, [appointment.doctorUserId ?? ""]),
      appointment.departmentId
        ? HospitalDepartment.findOne({ hospitalId: session.payload.hospitalId, _id: appointment.departmentId }).select("name description icon status")
        : null,
      Consultation.findOne({
        hospitalId: session.payload.hospitalId,
        appointmentId: appointment.appointmentId,
      }).select("consultationId status diagnosis advice followUpDate completedAt"),
      Prescription.findOne({
        hospitalId: session.payload.hospitalId,
        appointmentId: appointment.appointmentId,
        status: "Issued",
      }).select("prescriptionId status issuedAt followUpDate"),
    ]);

    return successResponse(
      serializeDoc({
        ...appointment.toObject(),
        doctor: appointment.doctorUserId ? doctorById.get(appointment.doctorUserId) ?? null : null,
        department,
        consultation,
        prescription,
      }),
      "Patient appointment fetched",
    );
  } catch (error) {
    return handleApiError(error);
  }
}
