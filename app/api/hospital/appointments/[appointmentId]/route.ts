import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import {
  appointmentEditableFields,
  loadAppointmentForHospital,
  pickDefined,
  validateAppointmentRefs,
} from "@/lib/hospital-clinical";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import HospitalDepartment from "@/models/HospitalDepartment";
import HospitalUser from "@/models/HospitalUser";
import Patient from "@/models/Patient";

const appointmentUpdateSchema = z.object({
  patientId: z.string().min(1).optional(),
  doctorUserId: z.string().optional().or(z.literal("")),
  departmentId: z.string().optional().or(z.literal("")),
  appointmentDate: z.coerce.date().optional(),
  appointmentTime: z.string().optional(),
  type: z.enum(["OPD", "Follow Up", "Emergency", "Online Request"]).optional(),
  source: z.enum(["Walk In", "Phone", "Online", "Follow Up"]).optional(),
  reason: z.string().optional(),
  notes: z.string().optional(),
});

type RouteContext = { params: Promise<{ appointmentId: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "appointments_view");
    const { appointmentId } = await context.params;
    await connectDb();

    const appointment = await loadAppointmentForHospital(session.payload.hospitalId, appointmentId);
    if (!appointment) return errorResponse("Appointment not found", 404);

    const [patient, doctor, department] = await Promise.all([
      Patient.findOne({ hospitalId: session.payload.hospitalId, patientId: appointment.patientId }).select(
        "patientId name phone email gender age status",
      ),
      appointment.doctorUserId
        ? HospitalUser.findOne({
            hospitalId: session.payload.hospitalId,
            _id: appointment.doctorUserId,
            role: "DOCTOR",
          }).select("name email phone role status")
        : null,
      appointment.departmentId
        ? HospitalDepartment.findOne({
            hospitalId: session.payload.hospitalId,
            _id: appointment.departmentId,
          }).select("name description icon status")
        : null,
    ]);

    return successResponse(
      serializeDoc({
        ...appointment.toObject(),
        patient,
        doctor,
        department,
      }),
      "Appointment fetched",
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "appointments_update");
    const hospitalId = session.payload.hospitalId;
    const { appointmentId } = await context.params;
    const body = appointmentUpdateSchema.parse(await req.json());
    await connectDb();

    await validateAppointmentRefs({
      hospitalId,
      patientId: body.patientId,
      doctorUserId: body.doctorUserId || undefined,
      departmentId: body.departmentId || undefined,
    });

    const appointment = await loadAppointmentForHospital(hospitalId, appointmentId);
    if (!appointment) return errorResponse("Appointment not found", 404);

    appointment.set(pickDefined(body, appointmentEditableFields));
    await appointment.save();

    return successResponse(serializeDoc(appointment), "Appointment updated");
  } catch (error) {
    return handleApiError(error);
  }
}
