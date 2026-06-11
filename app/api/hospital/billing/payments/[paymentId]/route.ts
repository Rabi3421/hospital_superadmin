import { NextRequest } from "next/server";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import Bill from "@/models/Bill";
import BillPayment from "@/models/BillPayment";
import Patient from "@/models/Patient";

type RouteContext = { params: Promise<{ paymentId: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "payments_view");
    const { paymentId } = await context.params;
    await connectDb();

    const payment = await BillPayment.findOne({ hospitalId: session.payload.hospitalId, paymentId });
    if (!payment) return errorResponse("Payment not found", 404);
    const [bill, patient] = await Promise.all([
      Bill.findOne({ hospitalId: session.payload.hospitalId, billId: payment.billId }),
      Patient.findOne({ hospitalId: session.payload.hospitalId, patientId: payment.patientId }).select(
        "patientId name phone email gender age",
      ),
    ]);

    return successResponse(serializeDoc({ ...payment.toObject(), bill, patient }), "Payment fetched");
  } catch (error) {
    return handleApiError(error);
  }
}
