import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { generateDepositId } from "@/lib/hospital-billing";
import { connectDb } from "@/lib/db";
import { endOfDay, escapeRegex, getPagination, startOfDay } from "@/lib/hospital-clinical";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import Patient from "@/models/Patient";
import PatientDeposit from "@/models/PatientDeposit";

const depositCreateSchema = z.object({
  patientId: z.string().min(1),
  amount: z.number().positive(),
  paymentMode: z.enum(["Cash", "UPI", "Card", "Bank Transfer", "Other"]),
  transactionId: z.string().optional(),
  depositDate: z.string().optional(),
  purpose: z.string().optional(),
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
    const session = await requireHospitalPermission(req, "deposits_view");
    const hospitalId = session.payload.hospitalId;
    const { page, limit, skip } = getPagination(req.nextUrl.searchParams);
    const filter: Record<string, unknown> = { hospitalId };

    ["patientId", "status"].forEach((key) => {
      const value = req.nextUrl.searchParams.get(key)?.trim();
      if (value) filter[key] = value;
    });
    const depositDate = dateBetween(req.nextUrl.searchParams);
    if (depositDate) filter.depositDate = depositDate;

    await connectDb();
    const search = (req.nextUrl.searchParams.get("search") ?? req.nextUrl.searchParams.get("q"))?.trim();
    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      const patients = await Patient.find({
        hospitalId,
        $or: [{ patientId: regex }, { name: regex }, { phone: regex }],
      }).select("patientId");
      filter.$or = [
        { depositId: regex },
        { purpose: regex },
        { patientId: { $in: patients.map((p) => p.patientId) } },
      ];
    }

    const [deposits, total] = await Promise.all([
      PatientDeposit.find(filter).sort({ depositDate: -1 }).skip(skip).limit(limit),
      PatientDeposit.countDocuments(filter),
    ]);

    const patients = await Patient.find({
      hospitalId,
      patientId: { $in: deposits.map((d) => d.patientId) },
    }).select("patientId name phone");
    const patientById = new Map(patients.map((p) => [p.patientId, p]));
    const enriched = deposits.map((d) => ({
      ...d.toObject(),
      patient: patientById.get(d.patientId) ?? null,
    }));

    return successResponse(serializeDoc(enriched), "Deposits fetched", 200, {
      page, limit, total, totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "deposits_create");
    const hospitalId = session.payload.hospitalId;
    const body = depositCreateSchema.parse(await req.json());
    await connectDb();

    const patient = await Patient.findOne({ hospitalId, patientId: body.patientId });
    if (!patient) return errorResponse("Patient not found", 404);

    const amount = Math.round((body.amount + Number.EPSILON) * 100) / 100;

    const deposit = await PatientDeposit.create({
      hospitalId,
      depositId: await generateDepositId(hospitalId),
      patientId: body.patientId,
      amount,
      usedAmount: 0,
      balanceAmount: amount,
      paymentMode: body.paymentMode,
      transactionId: body.transactionId ?? "",
      depositDate: body.depositDate ? new Date(body.depositDate) : new Date(),
      purpose: body.purpose ?? "",
      notes: body.notes ?? "",
      receivedBy: session.payload.userId,
      createdBy: session.payload.userId,
    });

    return successResponse(serializeDoc(deposit), "Deposit recorded", 201);
  } catch (error) {
    return handleApiError(error);
  }
}
