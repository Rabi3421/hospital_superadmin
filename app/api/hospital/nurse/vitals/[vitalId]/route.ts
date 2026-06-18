import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import { calculateBMI } from "@/lib/hospital-nurse";
import Patient from "@/models/Patient";
import PatientVitalRecord from "@/models/PatientVitalRecord";

const vitalUpdateSchema = z.object({
  temperature: z.number().optional(),
  pulse: z.number().optional(),
  bloodPressureSystolic: z.number().optional(),
  bloodPressureDiastolic: z.number().optional(),
  respiratoryRate: z.number().optional(),
  oxygenSaturation: z.number().optional(),
  weight: z.number().optional(),
  height: z.number().optional(),
  bloodSugar: z.number().optional(),
  painScore: z.number().min(0).max(10).optional(),
  notes: z.string().optional(),
  status: z.enum(["Active", "Corrected", "Deleted"]).optional(),
});

type RouteContext = { params: Promise<{ vitalId: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "nurse_vitals_view");
    const { vitalId } = await context.params;
    const hospitalId = session.payload.hospitalId;
    await connectDb();

    const filter: Record<string, unknown> = { hospitalId, vitalId };
    if (session.user.role === "NURSE") filter.nurseUserId = session.payload.userId;
    const vital = await PatientVitalRecord.findOne(filter);
    if (!vital) return errorResponse("Vital record not found", 404);

    const patient = await Patient.findOne({ hospitalId, patientId: vital.patientId }).select(
      "patientId name phone email gender age status",
    );

    return successResponse(
      serializeDoc({ ...vital.toObject(), patient }),
      "Vital record fetched",
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "nurse_vitals_update");
    const { vitalId } = await context.params;
    const hospitalId = session.payload.hospitalId;
    const body = vitalUpdateSchema.parse(await req.json());
    await connectDb();

    const filter: Record<string, unknown> = { hospitalId, vitalId };
    if (session.user.role === "NURSE") filter.nurseUserId = session.payload.userId;
    const vital = await PatientVitalRecord.findOne(filter);
    if (!vital) return errorResponse("Vital record not found", 404);

    if (body.temperature !== undefined) vital.temperature = body.temperature;
    if (body.pulse !== undefined) vital.pulse = body.pulse;
    if (body.bloodPressureSystolic !== undefined) vital.bloodPressureSystolic = body.bloodPressureSystolic;
    if (body.bloodPressureDiastolic !== undefined) vital.bloodPressureDiastolic = body.bloodPressureDiastolic;
    if (body.respiratoryRate !== undefined) vital.respiratoryRate = body.respiratoryRate;
    if (body.oxygenSaturation !== undefined) vital.oxygenSaturation = body.oxygenSaturation;
    if (body.weight !== undefined) vital.weight = body.weight;
    if (body.height !== undefined) vital.height = body.height;
    if (body.bloodSugar !== undefined) vital.bloodSugar = body.bloodSugar;
    if (body.painScore !== undefined) vital.painScore = body.painScore;
    if (body.notes !== undefined) vital.notes = body.notes;
    if (body.status !== undefined) vital.status = body.status;

    const weight = body.weight ?? vital.weight;
    const height = body.height ?? vital.height;
    if (weight && height && (body.weight !== undefined || body.height !== undefined)) {
      vital.bmi = calculateBMI(weight, height);
    }

    vital.updatedBy = session.payload.userId;
    await vital.save();

    return successResponse(serializeDoc(vital), "Vital record updated");
  } catch (error) {
    return handleApiError(error);
  }
}
