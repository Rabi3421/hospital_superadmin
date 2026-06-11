import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { calculateBillTotals, getBillStatusFromAmounts } from "@/lib/hospital-billing";
import { connectDb } from "@/lib/db";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import Appointment from "@/models/Appointment";
import Bill from "@/models/Bill";
import BillPayment from "@/models/BillPayment";
import Consultation from "@/models/Consultation";
import HospitalUser from "@/models/HospitalUser";
import LabOrder from "@/models/LabOrder";
import Patient from "@/models/Patient";
import PharmacySale from "@/models/PharmacySale";

const billItemSchema = z.object({
  itemType: z.enum(["Consultation", "Lab", "Pharmacy", "Procedure", "Other"]),
  name: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
  total: z.number().optional(),
});

const billUpdateSchema = z.object({
  items: z.array(billItemSchema).min(1).optional(),
  discountType: z.enum(["None", "Flat", "Percentage"]).optional(),
  discountValue: z.number().min(0).optional(),
  taxAmount: z.number().min(0).optional(),
  notes: z.string().optional(),
});

type RouteContext = { params: Promise<{ billId: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "billing_view");
    const { billId } = await context.params;
    await connectDb();

    const bill = await Bill.findOne({ hospitalId: session.payload.hospitalId, billId });
    if (!bill) return errorResponse("Bill not found", 404);

    const [payments, patient, appointment, consultation, doctor, labOrder, pharmacySale] = await Promise.all([
      BillPayment.find({ hospitalId: session.payload.hospitalId, billId: bill.billId }).sort({ paymentDate: -1, createdAt: -1 }),
      Patient.findOne({ hospitalId: session.payload.hospitalId, patientId: bill.patientId }).select("patientId name phone email gender age"),
      bill.appointmentId ? Appointment.findOne({ hospitalId: session.payload.hospitalId, appointmentId: bill.appointmentId }) : null,
      bill.consultationId ? Consultation.findOne({ hospitalId: session.payload.hospitalId, consultationId: bill.consultationId }) : null,
      bill.doctorUserId
        ? HospitalUser.findOne({ hospitalId: session.payload.hospitalId, _id: bill.doctorUserId }).select("name email phone role status")
        : null,
      bill.sourceType === "LabOrder" && bill.sourceId
        ? LabOrder.findOne({ hospitalId: session.payload.hospitalId, labOrderId: bill.sourceId })
        : null,
      bill.sourceType === "PharmacySale" && bill.sourceId
        ? PharmacySale.findOne({ hospitalId: session.payload.hospitalId, saleId: bill.sourceId })
        : null,
    ]);

    return successResponse(
      serializeDoc({
        bill: { ...bill.toObject(), totalAmount: bill.grandTotal },
        payments,
        patient,
        receiptSummary: {
          receiptNumber: bill.billId,
          paymentCount: payments.length,
          successfulPaymentCount: payments.filter((payment) => payment.status === "Success").length,
        },
        source: {
          sourceType: bill.sourceType,
          sourceId: bill.sourceId,
          sourceRefId: bill.sourceRefId,
          appointment,
          consultation,
          doctor: doctor ? { ...doctor.toObject(), userId: String(doctor._id) } : null,
          labOrder,
          pharmacySale,
        },
      }),
      "Bill fetched",
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "billing_update");
    const { billId } = await context.params;
    const body = billUpdateSchema.parse(await req.json());
    await connectDb();

    const bill = await Bill.findOne({ hospitalId: session.payload.hospitalId, billId });
    if (!bill) return errorResponse("Bill not found", 404);
    if (!["Draft", "Unpaid"].includes(bill.status)) {
      return errorResponse("Only draft or unpaid bills can be edited", 409);
    }

    const totals = calculateBillTotals(
      body.items ?? bill.items,
      body.discountType ?? bill.discountType,
      body.discountValue ?? bill.discountValue,
      body.taxAmount ?? bill.taxAmount,
    );
    if (totals.grandTotal < bill.paidAmount) {
      return errorResponse("Bill total cannot be reduced below the amount already paid", 409);
    }
    bill.set({
      ...totals,
      dueAmount: Math.max(totals.grandTotal - bill.paidAmount, 0),
      status: bill.status === "Draft" ? "Draft" : getBillStatusFromAmounts(totals.grandTotal, bill.paidAmount),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
    });
    await bill.save();

    return successResponse(serializeDoc({ ...bill.toObject(), totalAmount: bill.grandTotal }), "Bill updated");
  } catch (error) {
    return handleApiError(error);
  }
}
