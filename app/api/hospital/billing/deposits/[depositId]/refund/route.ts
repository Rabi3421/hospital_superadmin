import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { generateRefundId } from "@/lib/hospital-billing";
import { connectDb } from "@/lib/db";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import PatientDeposit from "@/models/PatientDeposit";
import Refund from "@/models/Refund";

const refundSchema = z.object({
  amount: z.number().positive().optional(),
  refundMode: z.enum(["Cash", "UPI", "Card", "Bank Transfer", "Original Payment Method", "Other"]),
  reason: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ depositId: string }> }) {
  try {
    const session = await requireHospitalPermission(req, "payments_refund");
    const hospitalId = session.payload.hospitalId;
    const { depositId } = await params;
    const body = refundSchema.parse(await req.json());
    await connectDb();

    const deposit = await PatientDeposit.findOne({ hospitalId, depositId });
    if (!deposit) return errorResponse("Deposit not found", 404);
    if (deposit.status === "Refunded") return errorResponse("Deposit already refunded", 400);
    if (deposit.balanceAmount <= 0) return errorResponse("No balance available to refund", 400);

    const amount = Math.min(body.amount ?? deposit.balanceAmount, deposit.balanceAmount);

    const refund = await Refund.create({
      hospitalId,
      refundId: await generateRefundId(hospitalId),
      billId: "",
      paymentId: "",
      patientId: deposit.patientId,
      amount,
      reason: body.reason ?? `Deposit ${depositId} balance refund`,
      refundMode: body.refundMode,
      status: "Processed",
      processedBy: session.payload.userId,
      processedAt: new Date(),
      notes: body.notes ?? `Refund of unused deposit ${depositId}`,
      createdBy: session.payload.userId,
    });

    deposit.refundedAmount = Math.round(((deposit.refundedAmount + amount) + Number.EPSILON) * 100) / 100;
    deposit.balanceAmount = Math.round(((deposit.amount - deposit.usedAmount - deposit.refundedAmount) + Number.EPSILON) * 100) / 100;
    deposit.status = deposit.balanceAmount <= 0 ? "Refunded" : deposit.usedAmount > 0 ? "Partially Used" : "Active";
    await deposit.save();

    return successResponse(serializeDoc({ deposit, refund }), "Deposit refund processed");
  } catch (error) {
    return handleApiError(error);
  }
}
