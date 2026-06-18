import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { endOfDay, getPagination, startOfDay } from "@/lib/hospital-clinical";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import { calculateBMI, generateVitalId } from "@/lib/hospital-nurse";
import Appointment from "@/models/Appointment";
import Patient from "@/models/Patient";
import PatientVitalRecord from "@/models/PatientVitalRecord";

const vitalCreateSchema = z.object({
  patientId: z.string().min(1),
  appointmentId: z.string().optional().or(z.literal("")),
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
});

function dateBetween(searchParams: URLSearchParams) {
  const fromDate = searchParams.get("fromDate");
  const toDate = searchParams.get("toDate");
  if (fromDate && toDate) return { $gte: startOfDay(new Date(fromDate)), $lte: endOfDay(new Date(toDate)) };
  if (fromDate) return { $gte: startOfDay(new Date(fromDate)) };
  if (toDate) return { $lte: endOfDay(new Date(toDate)) };
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "nurse_vitals_view");
    const hospitalId = session.payload.hospitalId;
    const { page, limit, skip } = getPagination(req.nextUrl.searchParams);
    const filter: Record<string, unknown> = { hospitalId };

    ["patientId", "appointmentId", "nurseUserId"].forEach((key) => {
      const value = req.nextUrl.searchParams.get(key)?.trim();
      if (value) filter[key] = value;
    });

    if (session.user.role === "NURSE") filter.nurseUserId = session.payload.userId;

    const recordedAt = dateBetween(req.nextUrl.searchParams);
    if (recordedAt) filter.recordedAt = recordedAt;

    await connectDb();
    const [vitals, total] = await Promise.all([
      PatientVitalRecord.find(filter).sort({ recordedAt: -1 }).skip(skip).limit(limit),
      PatientVitalRecord.countDocuments(filter),
    ]);

    const patientIds = [...new Set(vitals.map((v) => v.patientId))];
    const patients = await Patient.find({ hospitalId, patientId: { $in: patientIds } }).select("patientId name phone");
    const patientMap = new Map(patients.map((p) => [p.patientId, p]));

    const enriched = vitals.map((vital) => ({
      ...vital.toObject(),
      patient: patientMap.get(vital.patientId) ? serializeDoc(patientMap.get(vital.patientId)) : null,
    }));

    return successResponse(serializeDoc(enriched), "Vitals fetched", 200, {
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
    const session = await requireHospitalPermission(req, "nurse_vitals_create");
    const hospitalId = session.payload.hospitalId;
    const body = vitalCreateSchema.parse(await req.json());
    await connectDb();

    const patient = await Patient.findOne({ hospitalId, patientId: body.patientId });
    if (!patient) return errorResponse("Patient not found", 404);

    if (body.appointmentId) {
      const appointment = await Appointment.findOne({ hospitalId, appointmentId: body.appointmentId });
      if (!appointment) return errorResponse("Appointment not found", 404);
      if (appointment.patientId !== body.patientId) return errorResponse("Appointment patient does not match", 409);
    }

    const bmi = body.weight && body.height ? calculateBMI(body.weight, body.height) : undefined;

    const vital = await PatientVitalRecord.create({
      hospitalId,
      vitalId: await generateVitalId(hospitalId),
      patientId: body.patientId,
      appointmentId: body.appointmentId || "",
      consultationId: "",
      doctorUserId: "",
      nurseUserId: session.payload.userId,
      recordedAt: new Date(),
      temperature: body.temperature,
      pulse: body.pulse,
      bloodPressureSystolic: body.bloodPressureSystolic,
      bloodPressureDiastolic: body.bloodPressureDiastolic,
      respiratoryRate: body.respiratoryRate,
      oxygenSaturation: body.oxygenSaturation,
      weight: body.weight,
      height: body.height,
      bmi,
      bloodSugar: body.bloodSugar,
      painScore: body.painScore,
      notes: body.notes ?? "",
      status: "Active",
    });

    if (body.appointmentId) {
      await Appointment.updateOne(
        { hospitalId, appointmentId: body.appointmentId },
        { $set: { latestVitalId: vital.vitalId } },
      );
    }

    return successResponse(serializeDoc(vital), "Vitals recorded", 201);
  } catch (error) {
    if (error instanceof Error && error.message === "Patient not found") {
      return errorResponse(error.message, 404);
    }
    return handleApiError(error);
  }
}
