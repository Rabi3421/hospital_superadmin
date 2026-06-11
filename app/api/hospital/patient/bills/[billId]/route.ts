import { NextRequest } from "next/server";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requirePatientAuth } from "@/lib/hospital-patient";
import Bill from "@/models/Bill";
import BillPayment from "@/models/BillPayment";

type RouteContext = { params: Promise<{ billId: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const session = await requirePatientAuth(req);
    const { billId } = await context.params;
    await connectDb();
    const bill = await Bill.findOne({
      hospitalId: session.payload.hospitalId,
      patientId: session.patient.patientId,
      billId,
      status: { $ne: "Draft" },
    });
    if (!bill) return errorResponse("Bill not found", 404);
    const payments = await BillPayment.find({
      hospitalId: session.payload.hospitalId,
      patientId: session.patient.patientId,
      billId: bill.billId,
    }).sort({ paymentDate: 1, createdAt: 1 });

    return successResponse(
      serializeDoc({
        billId: bill.billId,
        sourceType: bill.sourceType,
        sourceRefId: bill.sourceRefId,
        items: bill.items,
        subtotal: bill.subtotal,
        discountType: bill.discountType,
        discountValue: bill.discountValue,
        discountAmount: bill.discountAmount,
        taxAmount: bill.taxAmount,
        totalAmount: bill.grandTotal,
        grandTotal: bill.grandTotal,
        paidAmount: bill.paidAmount,
        dueAmount: bill.dueAmount,
        status: bill.status,
        payments,
        createdAt: bill.createdAt,
        updatedAt: bill.updatedAt,
      }),
      "Patient bill fetched",
    );
  } catch (error) {
    return handleApiError(error);
  }
}
