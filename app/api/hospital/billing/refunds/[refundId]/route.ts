import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { processRefundOnBill } from "@/lib/hospital-billing";
import { connectDb } from "@/lib/db";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import Bill from "@/models/Bill";
import BillPayment from "@/models/BillPayment";
import Patient from "@/models/Patient";
import Refund from "@/models/Refund";

const refundUpdateSchema = z.object({
  status: z.enum(["Approved", "Rejected", "Processed"]).optional(),
  rejectionReason: z.string().optional(),
  transactionId: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ refundId: string }> }) {
  try {
    const session = await requireHospitalPermission(req, "refunds_view");
    const hospitalId = session.payload.hospitalId;
    const { refundId } = await params;
    await connectDb();

    const refund = await Refund.findOne({ hospitalId, refundId });
    if (!refund) return errorResponse("Refund not found", 404);

    const [bill, payment, patient] = await Promise.all([
      Bill.findOne({ hospitalId, billId: refund.billId }),
      BillPayment.findOne({ hospitalId, paymentId: refund.paymentId }),
      Patient.findOne({ hospitalId, patientId: refund.patientId }).select("patientId name phone email gender age"),
    ]);

    return successResponse(serializeDoc({ ...refund.toObject(), bill, payment, patient }), "Refund details");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ refundId: string }> }) {
  try {
    const session = await requireHospitalPermission(req, "refunds_approve");
    const hospitalId = session.payload.hospitalId;
    const { refundId } = await params;
    const body = refundUpdateSchema.parse(await req.json());
    await connectDb();

    const refund = await Refund.findOne({ hospitalId, refundId });
    if (!refund) return errorResponse("Refund not found", 404);

    if (body.status === "Approved" && refund.status !== "Pending") {
      return errorResponse("Only pending refunds can be approved", 400);
    }
    if (body.status === "Rejected" && refund.status !== "Pending") {
      return errorResponse("Only pending refunds can be rejected", 400);
    }
    if (body.status === "Processed" && refund.status !== "Approved") {
      return errorResponse("Only approved refunds can be processed", 400);
    }

    if (body.status === "Approved") {
      refund.status = "Approved";
      refund.approvedBy = session.payload.userId;
    } else if (body.status === "Rejected") {
      refund.status = "Rejected";
      refund.rejectedBy = session.payload.userId;
      refund.rejectionReason = body.rejectionReason ?? "";
    } else if (body.status === "Processed") {
      refund.processedBy = session.payload.userId;
      if (body.transactionId) refund.transactionId = body.transactionId;
      const result = await processRefundOnBill(refundId, hospitalId);
      return successResponse(serializeDoc(result.refund), "Refund processed and bill updated");
    }

    if (body.notes !== undefined) refund.notes = body.notes;
    await refund.save();

    return successResponse(serializeDoc(refund), "Refund updated");
  } catch (error) {
    return handleApiError(error);
  }
}
