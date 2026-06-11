import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { generateBillPaymentId, refreshBillPaymentStatus } from "@/lib/hospital-billing";
import { connectDb } from "@/lib/db";
import { endOfDay, escapeRegex, getPagination, startOfDay } from "@/lib/hospital-clinical";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import Bill from "@/models/Bill";
import BillPayment from "@/models/BillPayment";
import Patient from "@/models/Patient";

const paymentCreateSchema = z.object({
  billId: z.string().min(1),
  amount: z.number().positive(),
  paymentMode: z.enum(["Cash", "UPI", "Card", "Bank Transfer", "Insurance", "Other"]),
  transactionId: z.string().optional(),
  transactionRef: z.string().optional(),
  paymentDate: z.coerce.date().optional(),
  status: z.enum(["Success", "Failed"]).optional(),
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
    const session = await requireHospitalPermission(req, "payments_view");
    const hospitalId = session.payload.hospitalId;
    const { page, limit, skip } = getPagination(req.nextUrl.searchParams);
    const filter: Record<string, unknown> = { hospitalId };

    ["billId", "patientId", "paymentMode", "status"].forEach((key) => {
      const value = req.nextUrl.searchParams.get(key)?.trim();
      if (value) filter[key] = value;
    });
    const date = req.nextUrl.searchParams.get("date");
    const paymentDate = date ? { $gte: startOfDay(new Date(date)), $lte: endOfDay(new Date(date)) } : dateBetween(req.nextUrl.searchParams);
    if (paymentDate) filter.paymentDate = paymentDate;

    await connectDb();
    const search = (req.nextUrl.searchParams.get("search") ?? req.nextUrl.searchParams.get("q"))?.trim();
    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      const patients = await Patient.find({
        hospitalId,
        $or: [{ patientId: regex }, { name: regex }, { phone: regex }],
      }).select("patientId");
      filter.$or = [
        { paymentId: regex },
        { billId: regex },
        { transactionId: regex },
        { patientId: { $in: patients.map((patient) => patient.patientId) } },
      ];
    }
    const [payments, total] = await Promise.all([
      BillPayment.find(filter).sort({ paymentDate: -1, createdAt: -1 }).skip(skip).limit(limit),
      BillPayment.countDocuments(filter),
    ]);

    const [bills, patients] = await Promise.all([
      Bill.find({ hospitalId, billId: { $in: payments.map((payment) => payment.billId) } }).select(
        "billId status grandTotal paidAmount dueAmount sourceType sourceId",
      ),
      Patient.find({ hospitalId, patientId: { $in: payments.map((payment) => payment.patientId) } }).select(
        "patientId name phone gender age",
      ),
    ]);
    const billById = new Map(bills.map((bill) => [bill.billId, bill]));
    const patientById = new Map(patients.map((patient) => [patient.patientId, patient]));
    const enrichedPayments = payments.map((payment) => ({
      ...payment.toObject(),
      bill: billById.get(payment.billId) ?? null,
      patient: patientById.get(payment.patientId) ?? null,
    }));

    return successResponse(serializeDoc(enrichedPayments), "Payments fetched", 200, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "payments_create");
    const hospitalId = session.payload.hospitalId;
    const body = paymentCreateSchema.parse(await req.json());
    await connectDb();

    const bill = await Bill.findOne({ hospitalId, billId: body.billId });
    if (!bill) return errorResponse("Bill not found", 404);
    if (bill.status === "Draft") return errorResponse("Draft bills cannot accept payments", 409);
    if (bill.status === "Cancelled") return errorResponse("Cannot add payment to a cancelled bill", 409);
    if ((body.status ?? "Success") === "Success" && body.amount > bill.dueAmount) {
      return errorResponse("Payment amount cannot exceed bill due amount", 409);
    }

    const payment = await BillPayment.create({
      hospitalId,
      paymentId: await generateBillPaymentId(hospitalId),
      billId: bill.billId,
      patientId: bill.patientId,
      amount: body.amount,
      paymentMode: body.paymentMode,
      transactionId: body.transactionId ?? body.transactionRef ?? "",
      paymentDate: body.paymentDate ?? new Date(),
      receivedBy: session.payload.userId,
      status: body.status ?? "Success",
      notes: body.notes ?? "",
    });

    let refreshedBill = bill;
    if (payment.status === "Success") {
      try {
        refreshedBill = await refreshBillPaymentStatus(bill.billId, hospitalId);
      } catch (error) {
        await BillPayment.deleteOne({ hospitalId, paymentId: payment.paymentId });
        throw error;
      }
    }

    return successResponse(serializeDoc({ payment, bill: refreshedBill }), "Payment recorded", 201);
  } catch (error) {
    if (error instanceof Error && error.message.includes("E11000")) {
      return errorResponse("Payment ID already exists, please retry", 409);
    }
    return handleApiError(error);
  }
}
