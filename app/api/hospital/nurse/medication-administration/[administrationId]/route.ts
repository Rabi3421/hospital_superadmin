import { NextRequest } from "next/server";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import MedicationAdministrationRecord from "@/models/MedicationAdministrationRecord";
import Patient from "@/models/Patient";

type RouteContext = { params: Promise<{ administrationId: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "nurse_medication_administration_view");
    const { administrationId } = await context.params;
    const hospitalId = session.payload.hospitalId;
    await connectDb();

    const filter: Record<string, unknown> = { hospitalId, administrationId };
    if (session.user.role === "NURSE") filter.administeredBy = session.payload.userId;
    const record = await MedicationAdministrationRecord.findOne(filter);
    if (!record) return errorResponse("Medication administration record not found", 404);

    const patient = await Patient.findOne({ hospitalId, patientId: record.patientId }).select(
      "patientId name phone email gender age status",
    );

    return successResponse(
      serializeDoc({ ...record.toObject(), patient }),
      "Medication administration record fetched",
    );
  } catch (error) {
    return handleApiError(error);
  }
}
