import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { patientEditableFields, pickDefined } from "@/lib/hospital-clinical";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import Patient from "@/models/Patient";

const patientUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().min(6).optional(),
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

type RouteContext = { params: Promise<{ patientId: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "patients_view");
    const { patientId } = await context.params;
    await connectDb();

    const patient = await Patient.findOne({ hospitalId: session.payload.hospitalId, patientId });
    if (!patient) return errorResponse("Patient not found", 404);

    return successResponse(serializeDoc(patient), "Patient fetched");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "patients_update");
    const { patientId } = await context.params;
    const body = patientUpdateSchema.parse(await req.json());
    await connectDb();

    const patient = await Patient.findOneAndUpdate(
      { hospitalId: session.payload.hospitalId, patientId },
      { $set: pickDefined(body, patientEditableFields) },
      { new: true },
    );
    if (!patient) return errorResponse("Patient not found", 404);

    return successResponse(serializeDoc(patient), "Patient updated");
  } catch (error) {
    return handleApiError(error);
  }
}
