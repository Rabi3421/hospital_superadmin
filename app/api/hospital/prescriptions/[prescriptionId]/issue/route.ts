import { NextRequest } from "next/server";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { assertDoctorOwnsRecord } from "@/lib/hospital-clinical";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import Prescription from "@/models/Prescription";

type RouteContext = { params: Promise<{ prescriptionId: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "prescriptions_issue");
    const { prescriptionId } = await context.params;
    await connectDb();

    const prescription = await Prescription.findOne({ hospitalId: session.payload.hospitalId, prescriptionId });
    if (!prescription) return errorResponse("Prescription not found", 404);
    assertDoctorOwnsRecord(session.user.role, session.payload.userId, prescription.doctorUserId);
    if (prescription.status !== "Draft") return errorResponse("Only draft prescriptions can be issued", 409);
    if (!prescription.medicines.length && !prescription.testsRecommended.length && !prescription.generalInstructions?.trim()) {
      return errorResponse("Add a medicine, test recommendation, or instruction before issuing", 400);
    }
    const incompleteMedicine = prescription.medicines.find(
      (medicine) => !medicine.dosage?.trim() || !medicine.frequency?.trim() || !medicine.duration?.trim(),
    );
    if (incompleteMedicine) {
      return errorResponse(
        `Add dosage, frequency, and duration for ${incompleteMedicine.medicineName} before issuing`,
        400,
      );
    }

    prescription.status = "Issued";
    prescription.issuedAt = new Date();
    await prescription.save();

    return successResponse(serializeDoc(prescription), "Prescription issued");
  } catch (error) {
    return handleApiError(error);
  }
}
