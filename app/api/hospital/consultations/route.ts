import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import {
  assertDoctorOwnsRecord,
  dateRangeFor,
  generateConsultationId,
  getPagination,
  validateAppointmentRefs,
} from "@/lib/hospital-clinical";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import Appointment from "@/models/Appointment";
import Consultation from "@/models/Consultation";
import Patient from "@/models/Patient";
import Prescription from "@/models/Prescription";

const vitalsSchema = z.object({
  temperature: z.string().optional(),
  bloodPressure: z.string().optional(),
  pulse: z.string().optional(),
  spo2: z.string().optional(),
  weight: z.string().optional(),
  height: z.string().optional(),
  bloodSugar: z.string().optional(),
});

const consultationCreateSchema = z.object({
  appointmentId: z.string().min(1),
  patientId: z.string().min(1),
  doctorUserId: z.string().min(1).optional(),
  departmentId: z.string().optional().or(z.literal("")),
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

export async function GET(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "consultations_view");
    const hospitalId = session.payload.hospitalId;
    const { page, limit, skip } = getPagination(req.nextUrl.searchParams);
    const filter: Record<string, unknown> = { hospitalId };

    ["patientId", "doctorUserId", "appointmentId", "status"].forEach((key) => {
      const value = req.nextUrl.searchParams.get(key)?.trim();
      if (value) filter[key] = value;
    });
    if (session.user.role === "DOCTOR") filter.doctorUserId = session.payload.userId;

    const date = req.nextUrl.searchParams.get("date");
    if (date) filter.createdAt = dateRangeFor(date);

    await connectDb();
    const [consultations, total] = await Promise.all([
      Consultation.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Consultation.countDocuments(filter),
    ]);
    const patientIds = [...new Set(consultations.map((consultation) => consultation.patientId).filter(Boolean))];
    const appointmentIds = consultations.map((consultation) => consultation.appointmentId);
    const consultationIds = consultations.map((consultation) => consultation.consultationId);
    const [patients, appointments, prescriptions] = await Promise.all([
      Patient.find({ hospitalId, patientId: { $in: patientIds } }).select(
        "patientId name phone gender age bloodGroup allergies status",
      ),
      Appointment.find({ hospitalId, appointmentId: { $in: appointmentIds } }).select(
        "appointmentId appointmentDate appointmentTime scheduledStartTime reason type status tokenNumber",
      ),
      Prescription.find({ hospitalId, consultationId: { $in: consultationIds }, status: { $ne: "Cancelled" } }).select(
        "prescriptionId consultationId status issuedAt",
      ),
    ]);
    const patientById = new Map(patients.map((patient) => [patient.patientId, patient]));
    const appointmentById = new Map(appointments.map((appointment) => [appointment.appointmentId, appointment]));
    const prescriptionByConsultationId = new Map(
      prescriptions.map((prescription) => [prescription.consultationId, prescription]),
    );
    const enriched = consultations.map((consultation) => ({
      ...consultation.toObject(),
      patient: patientById.get(consultation.patientId) ?? null,
      appointment: appointmentById.get(consultation.appointmentId) ?? null,
      prescription: prescriptionByConsultationId.get(consultation.consultationId) ?? null,
    }));

    return successResponse(serializeDoc(enriched), "Consultations fetched", 200, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "consultations_create");
    const hospitalId = session.payload.hospitalId;
    const body = consultationCreateSchema.parse(await req.json());
    const doctorUserId = session.user.role === "DOCTOR" ? session.payload.userId : body.doctorUserId;
    if (!doctorUserId) return errorResponse("Doctor user ID is required", 400);
    assertDoctorOwnsRecord(session.user.role, session.payload.userId, doctorUserId);

    await connectDb();
    const appointment = await Appointment.findOne({ hospitalId, appointmentId: body.appointmentId });
    if (!appointment) return errorResponse("Appointment not found", 404);
    if (appointment.patientId !== body.patientId) return errorResponse("Appointment patient does not match consultation", 409);
    if (appointment.doctorUserId && appointment.doctorUserId !== doctorUserId) {
      return errorResponse("Appointment doctor does not match consultation", 409);
    }
    if (!["Scheduled", "Checked In", "In Consultation"].includes(appointment.status)) {
      return errorResponse(`Cannot create consultation for ${appointment.status.toLowerCase()} appointment`, 409);
    }

    await validateAppointmentRefs({
      hospitalId,
      patientId: body.patientId,
      doctorUserId,
      departmentId: body.departmentId || undefined,
    });

    const existing = await Consultation.findOne({ hospitalId, appointmentId: body.appointmentId });
    if (existing) return errorResponse("A consultation already exists for this appointment", 409);

    if (["Scheduled", "Checked In"].includes(appointment.status)) {
      appointment.status = "In Consultation";
      appointment.consultationStartedAt = appointment.consultationStartedAt ?? new Date();
      if (!appointment.doctorUserId) appointment.doctorUserId = doctorUserId;
      await appointment.save();
    }

    const consultation = await Consultation.create({
      ...body,
      hospitalId,
      doctorUserId,
      consultationId: await generateConsultationId(hospitalId),
      departmentId: body.departmentId ?? appointment.departmentId ?? "",
      status: "Draft",
      createdBy: session.payload.userId,
    });

    return successResponse(serializeDoc(consultation), "Consultation created", 201);
  } catch (error) {
    if (error instanceof Error && error.message.includes("E11000")) {
      return errorResponse("A consultation already exists for this appointment", 409);
    }
    return handleApiError(error);
  }
}
