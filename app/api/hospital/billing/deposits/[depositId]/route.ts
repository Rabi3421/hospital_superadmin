import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import Patient from "@/models/Patient";
import PatientDeposit from "@/models/PatientDeposit";

const depositUpdateSchema = z.object({
  purpose: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ depositId: string }> }) {
  try {
    const session = await requireHospitalPermission(req, "deposits_view");
    const hospitalId = session.payload.hospitalId;
    const { depositId } = await params;
    await connectDb();

    const deposit = await PatientDeposit.findOne({ hospitalId, depositId });
    if (!deposit) return errorResponse("Deposit not found", 404);

    const patient = await Patient.findOne({ hospitalId, patientId: deposit.patientId })
      .select("patientId name phone email gender age");

    return successResponse(serializeDoc({ ...deposit.toObject(), patient }), "Deposit details");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ depositId: string }> }) {
  try {
    const session = await requireHospitalPermission(req, "deposits_update");
    const hospitalId = session.payload.hospitalId;
    const { depositId } = await params;
    const body = depositUpdateSchema.parse(await req.json());
    await connectDb();

    const deposit = await PatientDeposit.findOne({ hospitalId, depositId });
    if (!deposit) return errorResponse("Deposit not found", 404);
    if (deposit.status === "Refunded") return errorResponse("Cannot update refunded deposits", 400);

    if (body.purpose !== undefined) deposit.purpose = body.purpose;
    if (body.notes !== undefined) deposit.notes = body.notes;
    await deposit.save();

    return successResponse(serializeDoc(deposit), "Deposit updated");
  } catch (error) {
    return handleApiError(error);
  }
}
