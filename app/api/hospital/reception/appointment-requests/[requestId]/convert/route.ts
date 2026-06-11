import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import {
  generateAppointmentId,
  generatePatientId,
  generateTokenNumber,
  validateAppointmentRefs,
} from "@/lib/hospital-clinical";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import Appointment from "@/models/Appointment";
import HospitalAppointmentRequest from "@/models/HospitalAppointmentRequest";
import Patient from "@/models/Patient";

const convertSchema = z.object({
  doctorUserId: z.string().optional().or(z.literal("")),
  departmentId: z.string().optional().or(z.literal("")),
  appointmentDate: z.coerce.date().optional(),
  appointmentTime: z.string().optional(),
  notes: z.string().optional(),
});

type RouteContext = { params: Promise<{ requestId: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "appointments_create");
    const hospitalId = session.payload.hospitalId;
    const { requestId } = await context.params;
    const body = convertSchema.parse(await req.json().catch(() => ({})));
    await connectDb();

    const request = await HospitalAppointmentRequest.findOne({ _id: requestId, hospitalId });
    if (!request) return errorResponse("Appointment request not found", 404);
    if (request.appointmentId) {
      const existingAppointment = await Appointment.findOne(
        request.patientId
          ? { hospitalId, patientId: request.patientId, appointmentId: request.appointmentId }
          : { hospitalId, appointmentId: request.appointmentId },
      );
      if (existingAppointment) {
        const existingPatient = request.patientId
          ? await Patient.findOne({ hospitalId, patientId: request.patientId })
          : await Patient.findOne({ hospitalId, phone: request.phone });
        return successResponse(
          serializeDoc({ appointment: existingAppointment, patient: existingPatient, appointmentRequest: request }),
          "Appointment request already converted",
        );
      }
    }
    if (request.status !== "New") {
      return errorResponse(`Appointment request is already ${request.status.toLowerCase()}`, 409);
    }

    let patient = request.patientId
      ? await Patient.findOne({ hospitalId, patientId: request.patientId })
      : await Patient.findOne({ hospitalId, phone: request.phone });
    if (!patient) {
      patient = await Patient.create({
        hospitalId,
        patientId: await generatePatientId(hospitalId),
        name: request.patientName,
        phone: request.phone,
        email: request.email ?? "",
        status: "Active",
        createdBy: session.payload.userId,
      });
    }

    const appointmentDate = body.appointmentDate ?? request.preferredDate;
    const departmentId = body.departmentId ?? request.departmentId;
    const doctorUserId = body.doctorUserId || request.doctorUserId || "";
    await validateAppointmentRefs({
      hospitalId,
      patientId: patient.patientId,
      doctorUserId: doctorUserId || undefined,
      departmentId: departmentId || undefined,
    });

    const appointment = await Appointment.create({
      hospitalId,
      appointmentId: await generateAppointmentId(hospitalId, appointmentDate),
      patientId: patient.patientId,
      doctorUserId,
      departmentId: departmentId ?? "",
      appointmentDate,
      appointmentTime: body.appointmentTime ?? request.preferredTime,
      tokenNumber: await generateTokenNumber(hospitalId, appointmentDate),
      type: "Online Request",
      status: "Scheduled",
      source: "Online",
      reason: request.message ?? "",
      notes: body.notes ?? request.notes ?? "",
      createdBy: session.payload.userId,
    });

    request.status = "Confirmed";
    request.patientId = patient.patientId;
    request.appointmentId = appointment.appointmentId;
    request.notes = body.notes ?? request.notes ?? "Converted to appointment";
    await request.save();

    return successResponse(serializeDoc({ appointment, patient, appointmentRequest: request }), "Appointment request converted", 201);
  } catch (error) {
    return handleApiError(error);
  }
}
