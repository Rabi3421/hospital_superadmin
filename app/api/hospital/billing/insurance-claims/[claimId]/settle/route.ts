import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { generateBillPaymentId, refreshBillPaymentStatus } from "@/lib/hospital-billing";
import { connectDb } from "@/lib/db";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import Bill from "@/models/Bill";
import BillPayment from "@/models/BillPayment";
import InsuranceClaim from "@/models/InsuranceClaim";

const settleSchema = z.object({
  transactionId: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ claimId: string }> }) {
  try {
    const session = await requireHospitalPermission(req, "insurance_claims_update");
    const hospitalId = session.payload.hospitalId;
    const { claimId } = await params;
    const body = settleSchema.parse(await req.json());
    await connectDb();

    const claim = await InsuranceClaim.findOne({ hospitalId, claimId });
    if (!claim) return errorResponse("Insurance claim not found", 404);
    if (claim.status === "Settled") return errorResponse("Claim already settled", 400);
    if (!["Approved", "Partially Approved"].includes(claim.status)) {
      return errorResponse("Claim must be approved before settlement", 400);
    }
    if (claim.approvedAmount <= 0) return errorResponse("No approved amount to settle", 400);

    const bill = await Bill.findOne({ hospitalId, billId: claim.billId });
    if (!bill) return errorResponse("Bill not found", 404);

    const settleAmount = Math.min(claim.approvedAmount, bill.dueAmount);
    if (settleAmount <= 0) return errorResponse("Bill has no outstanding dues", 400);

    const payment = await BillPayment.create({
      hospitalId,
      paymentId: await generateBillPaymentId(hospitalId),
      billId: claim.billId,
      patientId: claim.patientId,
      amount: settleAmount,
      paymentMode: "Insurance",
      paymentDate: new Date(),
      receivedBy: session.payload.userId,
      status: "Success",
      transactionId: body.transactionId ?? "",
      notes: body.notes ?? `Insurance settlement for claim ${claimId}`,
    });

    claim.status = "Settled";
    claim.settledAt = new Date();
    await claim.save();

    await refreshBillPaymentStatus(claim.billId, hospitalId);

    return successResponse(serializeDoc({ claim, payment }), "Insurance claim settled");
  } catch (error) {
    return handleApiError(error);
  }
}
