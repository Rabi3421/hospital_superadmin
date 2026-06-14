import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { escapeRegex, generatePatientId, getPagination } from "@/lib/hospital-clinical";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import { ensureHospitalCapacity } from "@/lib/hospital-capacity";
import Appointment from "@/models/Appointment";
import Consultation from "@/models/Consultation";
import Patient from "@/models/Patient";

const patientCreateSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(6),
  email: z.string().email().optional().or(z.literal("")),
  gender: z.enum(["Male", "Female", "Other"]).optional(),
  dateOfBirth: z.coerce.date().optional(),
  age: z.number().int().min(0).optional(),
  bloodGroup: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  medicalHistory: z.string().optional(),
  allergies: z.string().optional(),
  currentMedications: z.string().optional(),
  status: z.enum(["Active", "Inactive"]).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "patients_view");
    const hospitalId = session.payload.hospitalId;
    await connectDb();

    const { page, limit, skip } = getPagination(req.nextUrl.searchParams);
    const search = (req.nextUrl.searchParams.get("search") ?? req.nextUrl.searchParams.get("q"))?.trim();
    const status = req.nextUrl.searchParams.get("status")?.trim();
    const filter: Record<string, unknown> = { hospitalId };

    if (status) filter.status = status;
    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ patientId: regex }, { name: regex }, { phone: regex }, { email: regex }];
    }
    if (session.user.role === "DOCTOR") {
      const [appointmentPatientIds, consultationPatientIds] = await Promise.all([
        Appointment.distinct("patientId", { hospitalId, doctorUserId: session.payload.userId }),
        Consultation.distinct("patientId", { hospitalId, doctorUserId: session.payload.userId }),
      ]);
      filter.patientId = { $in: [...new Set([...appointmentPatientIds, ...consultationPatientIds])] };
    }

    const [patients, total] = await Promise.all([
      Patient.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Patient.countDocuments(filter),
    ]);

    return successResponse(serializeDoc(patients), "Patients fetched", 200, {
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
    const session = await requireHospitalPermission(req, "patients_create");
    const hospitalId = session.payload.hospitalId;
    const body = patientCreateSchema.parse(await req.json());
    await connectDb();
    await ensureHospitalCapacity(session.hospital, "patient");

    const patient = await Patient.create({
      ...body,
      hospitalId,
      patientId: await generatePatientId(hospitalId),
      createdBy: session.payload.userId,
      status: body.status ?? "Active",
    });

    return successResponse(serializeDoc(patient), "Patient created", 201);
  } catch (error) {
    if (error instanceof Error && error.message.includes("E11000")) {
      return errorResponse("Patient ID already exists, please retry", 409);
    }
    return handleApiError(error);
  }
}
