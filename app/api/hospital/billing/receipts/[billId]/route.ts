import { NextRequest } from "next/server";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requireHospitalAuth } from "@/lib/hospital-auth";
import { resolveHospitalPermissions } from "@/lib/hospital-permissions";
import Bill from "@/models/Bill";
import BillPayment from "@/models/BillPayment";
import Patient from "@/models/Patient";

type RouteContext = { params: Promise<{ billId: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalAuth(req);
    const permissions = resolveHospitalPermissions(session.user.role, session.user.permissions);
    const canViewReceipt =
      permissions.includes("receipts_view") ||
      permissions.includes("billing_view") ||
      permissions.includes("payments_view") ||
      permissions.includes("hospital:*");
    if (!canViewReceipt) return errorResponse("Forbidden: permission required", 403);

    const hospitalId = session.payload.hospitalId;
    const { billId } = await context.params;
    await connectDb();

    const bill = await Bill.findOne({ hospitalId, billId });
    if (!bill) return errorResponse("Bill not found", 404);
    const [patient, payments] = await Promise.all([
      Patient.findOne({ hospitalId, patientId: bill.patientId }).select("patientId name phone email gender age address city state pincode"),
      BillPayment.find({ hospitalId, billId: bill.billId }).sort({ paymentDate: 1, createdAt: 1 }),
    ]);

    return successResponse(
      serializeDoc({
        receiptNumber: `${session.hospital.settings.receiptPrefix || "RCP"}-${bill.billId}`,
        receiptPrefix: session.hospital.settings.receiptPrefix,
        generatedAt: new Date(),
        generatedBy: {
          userId: session.payload.userId,
          name: session.user.name,
          email: session.user.email,
          role: session.user.role,
        },
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
        patient,
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
      "Receipt fetched",
    );
  } catch (error) {
    return handleApiError(error);
  }
}
