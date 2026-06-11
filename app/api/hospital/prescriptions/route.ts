import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { assertDoctorOwnsRecord, dateRangeFor, generatePrescriptionId, getPagination } from "@/lib/hospital-clinical";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import Appointment from "@/models/Appointment";
import Consultation from "@/models/Consultation";
import Patient from "@/models/Patient";
import Prescription from "@/models/Prescription";

const medicineSchema = z.object({
  medicineName: z.string().min(1),
  dosage: z.string().optional(),
  frequency: z.string().optional(),
  duration: z.string().optional(),
  instructions: z.string().optional(),
});

const testRecommendedSchema = z.object({
  testName: z.string().min(1),
  instructions: z.string().optional(),
  priority: z.enum(["Routine", "Urgent"]).optional(),
});

const prescriptionCreateSchema = z.object({
  consultationId: z.string().min(1),
  medicines: z.array(medicineSchema).optional(),
  testsRecommended: z.array(testRecommendedSchema).optional(),
  generalInstructions: z.string().optional(),
  followUpDate: z.coerce.date().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "prescriptions_view");
    const hospitalId = session.payload.hospitalId;
    const { page, limit, skip } = getPagination(req.nextUrl.searchParams);
    const filter: Record<string, unknown> = { hospitalId };

    ["patientId", "doctorUserId", "consultationId", "appointmentId", "status"].forEach((key) => {
      const value = req.nextUrl.searchParams.get(key)?.trim();
      if (value) filter[key] = value;
    });
    if (session.user.role === "DOCTOR") filter.doctorUserId = session.payload.userId;

    const date = req.nextUrl.searchParams.get("date");
    if (date) filter.createdAt = dateRangeFor(date);

    await connectDb();
    const [prescriptions, total] = await Promise.all([
      Prescription.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Prescription.countDocuments(filter),
    ]);

    return successResponse(serializeDoc(prescriptions), "Prescriptions fetched", 200, {
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
    const session = await requireHospitalPermission(req, "prescriptions_create");
    const hospitalId = session.payload.hospitalId;
    const body = prescriptionCreateSchema.parse(await req.json());
    await connectDb();

    const consultation = await Consultation.findOne({ hospitalId, consultationId: body.consultationId });
    if (!consultation) return errorResponse("Consultation not found", 404);
    assertDoctorOwnsRecord(session.user.role, session.payload.userId, consultation.doctorUserId);

    const [appointment, patient] = await Promise.all([
      Appointment.findOne({ hospitalId, appointmentId: consultation.appointmentId }),
      Patient.findOne({ hospitalId, patientId: consultation.patientId }),
    ]);
    if (!appointment) return errorResponse("Appointment not found", 404);
    if (!patient) return errorResponse("Patient not found", 404);
    if (appointment.patientId !== consultation.patientId) {
      return errorResponse("Appointment patient does not match consultation", 409);
    }

    const existing = await Prescription.findOne({
      hospitalId,
      consultationId: consultation.consultationId,
      status: { $ne: "Cancelled" },
    });
    if (existing) return errorResponse("An active prescription already exists for this consultation", 409);

    const prescription = await Prescription.create({
      hospitalId,
      prescriptionId: await generatePrescriptionId(hospitalId),
      consultationId: consultation.consultationId,
      appointmentId: consultation.appointmentId,
      patientId: consultation.patientId,
      doctorUserId: consultation.doctorUserId,
      medicines: body.medicines ?? [],
      testsRecommended: body.testsRecommended ?? [],
      generalInstructions: body.generalInstructions ?? "",
      followUpDate: body.followUpDate,
      status: "Draft",
      createdBy: session.payload.userId,
    });

    return successResponse(serializeDoc(prescription), "Prescription created", 201);
  } catch (error) {
    if (error instanceof Error && error.message.includes("E11000")) {
      return errorResponse("Prescription ID already exists, please retry", 409);
    }
    return handleApiError(error);
  }
}
