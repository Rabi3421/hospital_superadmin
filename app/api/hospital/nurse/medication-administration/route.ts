import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { endOfDay, getPagination, startOfDay } from "@/lib/hospital-clinical";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import { generateMedicationAdministrationId } from "@/lib/hospital-nurse";
import Appointment from "@/models/Appointment";
import MedicationAdministrationRecord from "@/models/MedicationAdministrationRecord";
import Patient from "@/models/Patient";

const medicationCreateSchema = z.object({
  patientId: z.string().min(1),
  appointmentId: z.string().optional().or(z.literal("")),
  prescriptionId: z.string().optional().or(z.literal("")),
  medicineName: z.string().min(1),
  dose: z.string().optional(),
  route: z.string().optional(),
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
    const session = await requireHospitalPermission(req, "nurse_medication_administration_view");
    const hospitalId = session.payload.hospitalId;
    const { page, limit, skip } = getPagination(req.nextUrl.searchParams);
    const filter: Record<string, unknown> = { hospitalId };

    ["patientId", "appointmentId", "prescriptionId", "administeredBy"].forEach((key) => {
      const value = req.nextUrl.searchParams.get(key)?.trim();
      if (value) filter[key] = value;
    });

    if (session.user.role === "NURSE") filter.administeredBy = session.payload.userId;

    const administeredAt = dateBetween(req.nextUrl.searchParams);
    if (administeredAt) filter.administeredAt = administeredAt;

    await connectDb();
    const [records, total] = await Promise.all([
      MedicationAdministrationRecord.find(filter).sort({ administeredAt: -1 }).skip(skip).limit(limit),
      MedicationAdministrationRecord.countDocuments(filter),
    ]);

    const patientIds = [...new Set(records.map((r) => r.patientId))];
    const patients = await Patient.find({ hospitalId, patientId: { $in: patientIds } }).select("patientId name phone");
    const patientMap = new Map(patients.map((p) => [p.patientId, p]));

    const enriched = records.map((record) => ({
      ...record.toObject(),
      patient: patientMap.get(record.patientId) ? serializeDoc(patientMap.get(record.patientId)) : null,
    }));

    return successResponse(serializeDoc(enriched), "Medication administration records fetched", 200, {
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
    const session = await requireHospitalPermission(req, "nurse_medication_administration_create");
    const hospitalId = session.payload.hospitalId;
    const body = medicationCreateSchema.parse(await req.json());
    await connectDb();

    const patient = await Patient.findOne({ hospitalId, patientId: body.patientId });
    if (!patient) return errorResponse("Patient not found", 404);

    if (body.appointmentId) {
      const appointment = await Appointment.findOne({ hospitalId, appointmentId: body.appointmentId });
      if (!appointment) return errorResponse("Appointment not found", 404);
      if (appointment.patientId !== body.patientId) return errorResponse("Appointment patient does not match", 409);
    }

    const record = await MedicationAdministrationRecord.create({
      hospitalId,
      administrationId: await generateMedicationAdministrationId(hospitalId),
      patientId: body.patientId,
      appointmentId: body.appointmentId || "",
      prescriptionId: body.prescriptionId || "",
      medicineName: body.medicineName,
      dose: body.dose ?? "",
      route: body.route ?? "",
      administeredAt: new Date(),
      administeredBy: session.payload.userId,
      notes: body.notes ?? "",
      status: "Administered",
    } as Record<string, unknown>);

    return successResponse(serializeDoc(record), "Medication administration recorded", 201);
  } catch (error) {
    return handleApiError(error);
  }
}
