import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { assertDoctorOwnsRecord, consultationEditableFields, pickDefined } from "@/lib/hospital-clinical";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import Appointment from "@/models/Appointment";
import Consultation from "@/models/Consultation";
import HospitalDepartment from "@/models/HospitalDepartment";
import HospitalUser from "@/models/HospitalUser";
import Patient from "@/models/Patient";

const vitalsSchema = z.object({
  temperature: z.string().optional(),
  bloodPressure: z.string().optional(),
  pulse: z.string().optional(),
  spo2: z.string().optional(),
  weight: z.string().optional(),
  height: z.string().optional(),
  bloodSugar: z.string().optional(),
});

const consultationUpdateSchema = z.object({
  chiefComplaint: z.string().optional(),
  historyOfPresentIllness: z.string().optional(),
  symptoms: z.array(z.string()).optional(),
  vitals: vitalsSchema.optional(),
  examinationFindings: z.string().optional(),
  pastMedicalHistory: z.string().optional(),
  pastSurgicalHistory: z.string().optional(),
  familyHistory: z.string().optional(),
  socialHistory: z.string().optional(),
  allergyReview: z.string().optional(),
  medicationReview: z.string().optional(),
  diagnosis: z.string().optional(),
  differentialDiagnosis: z.string().optional(),
  clinicalNotes: z.string().optional(),
  proceduresPerformed: z.string().optional(),
  advice: z.string().optional(),
  privateNotes: z.string().optional(),
  disposition: z.enum(["Home", "Admit", "Emergency Referral", "Specialist Referral", "Observation"]).optional(),
  followUpDate: z.coerce.date().optional(),
});

type RouteContext = { params: Promise<{ consultationId: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "consultations_view");
    const { consultationId } = await context.params;
    await connectDb();

    const consultation = await Consultation.findOne({ hospitalId: session.payload.hospitalId, consultationId });
    if (!consultation) return errorResponse("Consultation not found", 404);
    assertDoctorOwnsRecord(session.user.role, session.payload.userId, consultation.doctorUserId);

    const hospitalId = session.payload.hospitalId;
    const [appointment, patient, doctor, department] = await Promise.all([
      Appointment.findOne({ hospitalId, appointmentId: consultation.appointmentId }),
      Patient.findOne({ hospitalId, patientId: consultation.patientId }).select(
        "patientId name phone email gender age dateOfBirth bloodGroup allergies currentMedications medicalHistory emergencyContactName emergencyContactPhone status",
      ),
      HospitalUser.findOne({ hospitalId, _id: consultation.doctorUserId, role: "DOCTOR" }).select(
        "name email phone role status",
      ),
      consultation.departmentId
        ? HospitalDepartment.findOne({ hospitalId, _id: consultation.departmentId }).select("name status")
        : null,
    ]);

    return successResponse(
      serializeDoc({ ...consultation.toObject(), appointment, patient, doctor, department }),
      "Consultation fetched",
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "consultations_update");
    const { consultationId } = await context.params;
    const body = consultationUpdateSchema.parse(await req.json());
    await connectDb();

    const consultation = await Consultation.findOne({ hospitalId: session.payload.hospitalId, consultationId });
    if (!consultation) return errorResponse("Consultation not found", 404);
    assertDoctorOwnsRecord(session.user.role, session.payload.userId, consultation.doctorUserId);
    if (consultation.status !== "Draft") return errorResponse("Only draft consultations can be edited", 409);

    consultation.set(pickDefined(body, consultationEditableFields));
    await consultation.save();

    return successResponse(serializeDoc(consultation), "Consultation updated");
  } catch (error) {
    return handleApiError(error);
  }
}
