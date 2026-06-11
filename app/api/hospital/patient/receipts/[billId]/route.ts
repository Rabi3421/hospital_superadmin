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
        receiptNumber: `${session.hospital.settings.receiptPrefix || "RCP"}-${bill.billId}`,
        receiptPrefix: session.hospital.settings.receiptPrefix,
        generatedAt: new Date(),
        generatedBy: { role: "PATIENT", userId: session.payload.userId, name: session.user.name },
        hospital: {
          hospitalId: session.hospital.hospitalId,
          name: session.hospital.name,
          type: session.hospital.type,
          address: session.hospital.address,
          city: session.hospital.city,
          state: session.hospital.state,
          pincode: session.hospital.pincode,
          phone: session.hospital.ownerPhone,
          email: session.hospital.ownerEmail,
          logoUrl: session.hospital.logoUrl,
          registrationNumber: session.hospital.registrationNumber,
          gstNumber: session.hospital.gstNumber,
        },
        patient: session.patient,
        bill: {
          billId: bill.billId,
          sourceType: bill.sourceType,
          sourceRefId: bill.sourceRefId,
          status: bill.status,
          createdAt: bill.createdAt,
          items: bill.items,
          notes: bill.notes,
        },
        payments,
        totals: {
          subtotal: bill.subtotal,
          discountType: bill.discountType,
          discountValue: bill.discountValue,
          discountAmount: bill.discountAmount,
          taxAmount: bill.taxAmount,
          grandTotal: bill.grandTotal,
          paidAmount: bill.paidAmount,
          dueAmount: bill.dueAmount,
        },
      }),
      "Patient receipt fetched",
    );
  } catch (error) {
    return handleApiError(error);
  }
}
