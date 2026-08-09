import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import Bill from "@/models/Bill";
import InsuranceClaim from "@/models/InsuranceClaim";
import Patient from "@/models/Patient";

const claimUpdateSchema = z.object({
  status: z.enum(["Submitted", "Under Review", "Approved", "Partially Approved", "Rejected", "Appealed"]).optional(),
  approvedAmount: z.number().min(0).optional(),
  rejectedAmount: z.number().min(0).optional(),
  tpaName: z.string().optional(),
  tpaReferenceNumber: z.string().optional(),
  preAuthNumber: z.string().optional(),
  diagnosisCode: z.string().optional(),
  remarks: z.string().optional(),
  rejectionReason: z.string().optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ claimId: string }> }) {
  try {
    const session = await requireHospitalPermission(req, "insurance_claims_view");
    const hospitalId = session.payload.hospitalId;
    const { claimId } = await params;
    await connectDb();

    const claim = await InsuranceClaim.findOne({ hospitalId, claimId });
    if (!claim) return errorResponse("Insurance claim not found", 404);

    const [bill, patient] = await Promise.all([
      Bill.findOne({ hospitalId, billId: claim.billId }),
      Patient.findOne({ hospitalId, patientId: claim.patientId }).select("patientId name phone email gender age"),
    ]);

    return successResponse(serializeDoc({ ...claim.toObject(), bill, patient }), "Claim details");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ claimId: string }> }) {
  try {
    const session = await requireHospitalPermission(req, "insurance_claims_update");
    const hospitalId = session.payload.hospitalId;
    const { claimId } = await params;
    const body = claimUpdateSchema.parse(await req.json());
    await connectDb();

    const claim = await InsuranceClaim.findOne({ hospitalId, claimId });
    if (!claim) return errorResponse("Insurance claim not found", 404);
    if (claim.status === "Settled") return errorResponse("Cannot update settled claims", 400);

    if (body.status === "Submitted" && !claim.submittedAt) claim.submittedAt = new Date();
    if (body.status && ["Approved", "Partially Approved", "Rejected"].includes(body.status)) claim.reviewedAt = new Date();

    const fields = ["status", "approvedAmount", "rejectedAmount", "tpaName", "tpaReferenceNumber", "preAuthNumber", "diagnosisCode", "remarks", "rejectionReason"] as const;
    fields.forEach((key) => {
      if (body[key] !== undefined) claim.set(key, body[key]);
    });

    await claim.save();
    return successResponse(serializeDoc(claim), "Claim updated");
  } catch (error) {
    return handleApiError(error);
  }
}
