import { NextRequest } from "next/server";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { buildPharmacySaleBillItems, createBillFromSource } from "@/lib/hospital-billing";
import { connectDb } from "@/lib/db";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import Patient from "@/models/Patient";
import PharmacySale from "@/models/PharmacySale";

type RouteContext = { params: Promise<{ saleId: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "billing_create");
    const hospitalId = session.payload.hospitalId;
    const { saleId } = await context.params;
    await connectDb();

    const sale = await PharmacySale.findOne({ hospitalId, saleId });
    if (!sale) return errorResponse("Pharmacy sale not found", 404);
    if (sale.saleStatus !== "Completed") return errorResponse("Only completed pharmacy sales can be billed", 409);
    const patient = await Patient.findOne({ hospitalId, patientId: sale.patientId });
    if (!patient) return errorResponse("Patient not found", 404);

    const { bill, created } = await createBillFromSource({
      hospitalId,
      patientId: sale.patientId,
      appointmentId: sale.appointmentId ?? "",
      consultationId: sale.consultationId ?? "",
      sourceType: "PharmacySale",
      sourceId: sale.saleId,
      sourceRefId: sale.saleId,
      items: buildPharmacySaleBillItems(sale),
      discountType: sale.discountType,
      discountValue: sale.discountValue,
      taxAmount: sale.taxAmount,
      notes: "Created from pharmacy sale",
      createdBy: session.payload.userId,
      metadata: {
        prescriptionId: sale.prescriptionId,
        pharmacyPaidAmount: sale.paidAmount,
        pharmacyPaymentStatus: sale.paymentStatus,
      },
    });

    return successResponse(serializeDoc(bill), created ? "Pharmacy sale bill created" : "Bill already exists for this pharmacy sale", created ? 201 : 200);
  } catch (error) {
    return handleApiError(error);
  }
}
