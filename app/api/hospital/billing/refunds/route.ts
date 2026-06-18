import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { generateRefundId } from "@/lib/hospital-billing";
import { connectDb } from "@/lib/db";
import { endOfDay, escapeRegex, getPagination, startOfDay } from "@/lib/hospital-clinical";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import Bill from "@/models/Bill";
import BillPayment from "@/models/BillPayment";
import Patient from "@/models/Patient";
import Refund from "@/models/Refund";

const refundCreateSchema = z.object({
  billId: z.string().min(1),
  paymentId: z.string().min(1),
  amount: z.number().positive(),
  reason: z.string().min(1),
  refundMode: z.enum(["Cash", "UPI", "Card", "Bank Transfer", "Original Payment Method", "Other"]),
  transactionId: z.string().optional(),
  notes: z.string().optional(),
});

function dateBetween(searchParams: URLSearchParams) {
  const dateFrom = searchParams.get("fromDate") ?? searchParams.get("dateFrom");
  const dateTo = searchParams.get("toDate") ?? searchParams.get("dateTo");
  if (dateFrom && dateTo) return { $gte: startOfDay(new Date(dateFrom)), $lte: endOfDay(new Date(dateTo)) };
  if (dateFrom) return { $gte: startOfDay(new Date(dateFrom)) };
  if (dateTo) return { $lte: endOfDay(new Date(dateTo)) };
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "refunds_view");
    const hospitalId = session.payload.hospitalId;
    const { page, limit, skip } = getPagination(req.nextUrl.searchParams);
    const filter: Record<string, unknown> = { hospitalId };

    ["billId", "paymentId", "patientId", "status"].forEach((key) => {
      const value = req.nextUrl.searchParams.get(key)?.trim();
      if (value) filter[key] = value;
    });
    const createdAt = dateBetween(req.nextUrl.searchParams);
    if (createdAt) filter.createdAt = createdAt;

    await connectDb();
    const search = (req.nextUrl.searchParams.get("search") ?? req.nextUrl.searchParams.get("q"))?.trim();
    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      const patients = await Patient.find({
        hospitalId,
        $or: [{ patientId: regex }, { name: regex }, { phone: regex }],
      }).select("patientId");
      filter.$or = [
        { refundId: regex },
        { billId: regex },
        { paymentId: regex },
        { patientId: { $in: patients.map((p) => p.patientId) } },
      ];
    }

    const [refunds, total] = await Promise.all([
      Refund.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Refund.countDocuments(filter),
    ]);

    const patients = await Patient.find({
      hospitalId,
      patientId: { $in: refunds.map((r) => r.patientId) },
    }).select("patientId name phone");
    const patientById = new Map(patients.map((p) => [p.patientId, p]));
    const enriched = refunds.map((r) => ({
      ...r.toObject(),
      patient: patientById.get(r.patientId) ?? null,
    }));

    return successResponse(serializeDoc(enriched), "Refunds fetched", 200, {
      page, limit, total, totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "refunds_create");
    const hospitalId = session.payload.hospitalId;
    const body = refundCreateSchema.parse(await req.json());
    await connectDb();

    const bill = await Bill.findOne({ hospitalId, billId: body.billId });
    if (!bill) return errorResponse("Bill not found", 404);

    const payment = await BillPayment.findOne({ hospitalId, paymentId: body.paymentId, billId: body.billId });
    if (!payment) return errorResponse("Payment not found for this bill", 404);
    if (payment.status !== "Success") return errorResponse("Can only refund successful payments", 400);
    if (body.amount > payment.amount) return errorResponse("Refund amount cannot exceed payment amount", 400);

    const existingRefunds = await Refund.find({
      hospitalId, paymentId: body.paymentId, status: { $in: ["Pending", "Approved", "Processed"] },
    });
    const alreadyRefunded = existingRefunds.reduce((sum, r) => sum + r.amount, 0);
    if (alreadyRefunded + body.amount > payment.amount) {
      return errorResponse(`Only ${payment.amount - alreadyRefunded} is available for refund on this payment`, 400);
    }

    const refund = await Refund.create({
      hospitalId,
      refundId: await generateRefundId(hospitalId),
      billId: body.billId,
      paymentId: body.paymentId,
      patientId: bill.patientId,
      amount: body.amount,
      reason: body.reason,
      refundMode: body.refundMode,
      transactionId: body.transactionId ?? "",
      notes: body.notes ?? "",
      createdBy: session.payload.userId,
    });

    return successResponse(serializeDoc(refund), "Refund request created", 201);
  } catch (error) {
    return handleApiError(error);
  }
}
