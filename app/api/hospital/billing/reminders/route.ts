import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { generateReminderId } from "@/lib/hospital-billing";
import { connectDb } from "@/lib/db";
import { endOfDay, getPagination, startOfDay } from "@/lib/hospital-clinical";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import Bill from "@/models/Bill";
import Patient from "@/models/Patient";
import PaymentReminder from "@/models/PaymentReminder";

const reminderCreateSchema = z.object({
  billId: z.string().min(1),
  channel: z.enum(["Phone", "WhatsApp", "Email", "SMS", "In App"]),
  message: z.string().min(1),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "billing_reminders_view");
    const hospitalId = session.payload.hospitalId;
    const { page, limit, skip } = getPagination(req.nextUrl.searchParams);
    const filter: Record<string, unknown> = { hospitalId };

    ["billId", "patientId", "channel", "status"].forEach((key) => {
      const value = req.nextUrl.searchParams.get(key)?.trim();
      if (value) filter[key] = value;
    });

    const dateFrom = req.nextUrl.searchParams.get("fromDate");
    const dateTo = req.nextUrl.searchParams.get("toDate");
    if (dateFrom || dateTo) {
      filter.sentAt = {};
      if (dateFrom) (filter.sentAt as Record<string, unknown>).$gte = startOfDay(new Date(dateFrom));
      if (dateTo) (filter.sentAt as Record<string, unknown>).$lte = endOfDay(new Date(dateTo));
    }

    await connectDb();
    const [reminders, total] = await Promise.all([
      PaymentReminder.find(filter).sort({ sentAt: -1 }).skip(skip).limit(limit),
      PaymentReminder.countDocuments(filter),
    ]);

    const patientIds = [...new Set(reminders.map((r) => r.patientId))];
    const patients = await Patient.find({ hospitalId, patientId: { $in: patientIds } }).select("patientId name phone");
    const patientMap = new Map(patients.map((p) => [p.patientId, p]));
    const enriched = reminders.map((r) => ({
      ...r.toObject(),
      patient: patientMap.get(r.patientId) ?? null,
    }));

    return successResponse(serializeDoc(enriched), "Reminders fetched", 200, {
      page, limit, total, totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "billing_reminders_create");
    const hospitalId = session.payload.hospitalId;
    const body = reminderCreateSchema.parse(await req.json());
    await connectDb();

    const bill = await Bill.findOne({ hospitalId, billId: body.billId });
    if (!bill) return errorResponse("Bill not found", 404);
    if (bill.dueAmount <= 0) return errorResponse("Bill has no outstanding dues", 400);

    const reminder = await PaymentReminder.create({
      hospitalId,
      reminderId: await generateReminderId(hospitalId),
      billId: body.billId,
      patientId: bill.patientId,
      channel: body.channel,
      message: body.message,
      dueAmount: bill.dueAmount,
      status: "Sent",
      sentBy: session.payload.userId,
      sentAt: new Date(),
      notes: body.notes ?? "",
    });

    return successResponse(serializeDoc(reminder), "Reminder logged", 201);
  } catch (error) {
    return handleApiError(error);
  }
}
