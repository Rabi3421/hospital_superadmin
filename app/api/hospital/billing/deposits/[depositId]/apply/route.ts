import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { generateBillPaymentId, refreshBillPaymentStatus } from "@/lib/hospital-billing";
import { connectDb } from "@/lib/db";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import Bill from "@/models/Bill";
import BillPayment from "@/models/BillPayment";
import PatientDeposit from "@/models/PatientDeposit";

const applySchema = z.object({
  billId: z.string().min(1),
  amount: z.number().positive(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ depositId: string }> }) {
  try {
    const session = await requireHospitalPermission(req, "deposits_create");
    const hospitalId = session.payload.hospitalId;
    const { depositId } = await params;
    const body = applySchema.parse(await req.json());
    await connectDb();

    const deposit = await PatientDeposit.findOne({ hospitalId, depositId });
    if (!deposit) return errorResponse("Deposit not found", 404);
    if (deposit.status === "Fully Used" || deposit.status === "Refunded") {
      return errorResponse("Deposit has no available balance", 400);
    }

    const amount = Math.round((body.amount + Number.EPSILON) * 100) / 100;
    if (amount > deposit.balanceAmount) {
      return errorResponse(`Only ${deposit.balanceAmount} available in deposit balance`, 400);
    }

    const bill = await Bill.findOne({ hospitalId, billId: body.billId });
    if (!bill) return errorResponse("Bill not found", 404);
    if (bill.status === "Draft" || bill.status === "Cancelled") {
      return errorResponse("Cannot apply deposit to draft or cancelled bills", 400);
    }
    if (bill.status === "Paid") return errorResponse("Bill is already fully paid", 400);
    if (amount > bill.dueAmount) {
      return errorResponse(`Amount exceeds bill due amount of ${bill.dueAmount}`, 400);
    }

    const payment = await BillPayment.create({
      hospitalId,
      paymentId: await generateBillPaymentId(hospitalId),
      billId: body.billId,
      patientId: deposit.patientId,
      amount,
      paymentMode: deposit.paymentMode,
      paymentDate: new Date(),
      receivedBy: session.payload.userId,
      status: "Success",
      notes: `Applied from deposit ${depositId}`,
    });

    deposit.usedAmount = Math.round(((deposit.usedAmount + amount) + Number.EPSILON) * 100) / 100;
    deposit.balanceAmount = Math.round(((deposit.amount - deposit.usedAmount - deposit.refundedAmount) + Number.EPSILON) * 100) / 100;
    deposit.appliedToBills.push({ billId: body.billId, amount, appliedAt: new Date() });
    deposit.status = deposit.balanceAmount <= 0 ? "Fully Used" : "Partially Used";
    await deposit.save();

    await refreshBillPaymentStatus(body.billId, hospitalId);

    return successResponse(serializeDoc({ deposit, payment }), "Deposit applied to bill");
  } catch (error) {
    return handleApiError(error);
  }
}
