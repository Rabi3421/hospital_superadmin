import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { calculateBillTotals, generateBillId, getBillStatusFromAmounts } from "@/lib/hospital-billing";
import { connectDb } from "@/lib/db";
import { endOfDay, escapeRegex, getPagination, startOfDay } from "@/lib/hospital-clinical";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import Appointment from "@/models/Appointment";
import Bill from "@/models/Bill";
import Consultation from "@/models/Consultation";
import HospitalUser from "@/models/HospitalUser";
import Patient from "@/models/Patient";

const billItemSchema = z.object({
  itemType: z.enum(["Consultation", "Lab", "Pharmacy", "Procedure", "Other"]),
  name: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
  total: z.number().optional(),
});

const billCreateSchema = z.object({
  patientId: z.string().min(1),
  appointmentId: z.string().optional().or(z.literal("")),
  consultationId: z.string().optional().or(z.literal("")),
  doctorUserId: z.string().optional().or(z.literal("")),
  items: z.array(billItemSchema).min(1),
  discountType: z.enum(["None", "Flat", "Percentage"]).optional(),
  discountValue: z.number().min(0).optional(),
  taxAmount: z.number().min(0).optional(),
  status: z.enum(["Draft", "Unpaid"]).optional(),
  sourceType: z.enum(["Manual", "Mixed"]).optional(),
  notes: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
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
    const session = await requireHospitalPermission(req, "billing_view");
    const hospitalId = session.payload.hospitalId;
    const { page, limit, skip } = getPagination(req.nextUrl.searchParams);
    const filter: Record<string, unknown> = { hospitalId };

    ["patientId", "appointmentId", "consultationId", "status", "sourceType"].forEach((key) => {
      const value = req.nextUrl.searchParams.get(key)?.trim();
      if (value) filter[key] = value;
    });
    const date = req.nextUrl.searchParams.get("date");
    const createdAt = date ? { $gte: startOfDay(new Date(date)), $lte: endOfDay(new Date(date)) } : dateBetween(req.nextUrl.searchParams);
    if (createdAt) filter.createdAt = createdAt;

    await connectDb();
    const search = (req.nextUrl.searchParams.get("search") ?? req.nextUrl.searchParams.get("q"))?.trim();
    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      const patients = await Patient.find({
        hospitalId,
        $or: [{ patientId: regex }, { name: regex }, { phone: regex }, { email: regex }],
      }).select("patientId");
      filter.$or = [{ billId: regex }, { sourceRefId: regex }, { patientId: { $in: patients.map((patient) => patient.patientId) } }];
    }

    const [bills, total] = await Promise.all([
      Bill.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Bill.countDocuments(filter),
    ]);

    const patients = await Patient.find({ hospitalId, patientId: { $in: bills.map((bill) => bill.patientId) } }).select(
      "patientId name phone gender age",
    );
    const patientById = new Map(patients.map((patient) => [patient.patientId, patient]));
    const enrichedBills = bills.map((bill) => ({
      ...bill.toObject(),
      totalAmount: bill.grandTotal,
      patient: patientById.get(bill.patientId) ?? null,
    }));

    return successResponse(serializeDoc(enrichedBills), "Bills fetched", 200, {
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
    const session = await requireHospitalPermission(req, "billing_create");
    const hospitalId = session.payload.hospitalId;
    const body = billCreateSchema.parse(await req.json());
    await connectDb();

    const patient = await Patient.findOne({ hospitalId, patientId: body.patientId });
    if (!patient) return errorResponse("Patient not found", 404);

    const [appointment, consultation, doctor] = await Promise.all([
      body.appointmentId ? Appointment.findOne({ hospitalId, appointmentId: body.appointmentId }) : null,
      body.consultationId ? Consultation.findOne({ hospitalId, consultationId: body.consultationId }) : null,
      body.doctorUserId ? HospitalUser.findOne({ hospitalId, _id: body.doctorUserId }) : null,
    ]);
    if (body.appointmentId && !appointment) return errorResponse("Appointment not found", 404);
    if (body.consultationId && !consultation) return errorResponse("Consultation not found", 404);
    if (body.doctorUserId && !doctor) return errorResponse("Doctor/user not found for this hospital", 404);
    if (appointment && appointment.patientId !== body.patientId) {
      return errorResponse("Appointment patient does not match bill patient", 409);
    }
    if (consultation && consultation.patientId !== body.patientId) {
      return errorResponse("Consultation patient does not match bill patient", 409);
    }
    if (appointment && consultation && appointment.appointmentId !== consultation.appointmentId) {
      return errorResponse("Consultation does not match bill appointment", 409);
    }

    const totals = calculateBillTotals(
      body.items,
      body.discountType ?? "None",
      body.discountValue ?? 0,
      body.taxAmount ?? 0,
    );
    const status = body.status === "Draft" ? "Draft" : getBillStatusFromAmounts(totals.grandTotal, 0);

    const bill = await Bill.create({
      hospitalId,
      billId: await generateBillId(hospitalId),
      patientId: body.patientId,
      appointmentId: body.appointmentId ?? "",
      consultationId: body.consultationId ?? "",
      doctorUserId: body.doctorUserId ?? consultation?.doctorUserId ?? appointment?.doctorUserId ?? "",
      ...totals,
      paidAmount: 0,
      dueAmount: totals.grandTotal,
      status,
      sourceType: body.sourceType ?? "Manual",
      metadata: body.metadata ?? {},
      notes: body.notes ?? "",
      createdBy: session.payload.userId,
    });

    return successResponse(serializeDoc(bill), "Bill created", 201);
  } catch (error) {
    if (error instanceof Error && error.message.includes("E11000")) {
      return errorResponse("Bill ID already exists, please retry", 409);
    }
    return handleApiError(error);
  }
}
