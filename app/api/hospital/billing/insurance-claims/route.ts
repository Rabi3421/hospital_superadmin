import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { generateClaimId } from "@/lib/hospital-billing";
import { connectDb } from "@/lib/db";
import { endOfDay, escapeRegex, getPagination, startOfDay } from "@/lib/hospital-clinical";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import Bill from "@/models/Bill";
import InsuranceClaim from "@/models/InsuranceClaim";
import Patient from "@/models/Patient";

const claimCreateSchema = z.object({
  billId: z.string().min(1),
  insuranceProvider: z.string().min(1),
  policyNumber: z.string().min(1),
  claimAmount: z.number().positive(),
  tpaName: z.string().optional(),
  tpaReferenceNumber: z.string().optional(),
  preAuthNumber: z.string().optional(),
  diagnosisCode: z.string().optional(),
  remarks: z.string().optional(),
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
    const session = await requireHospitalPermission(req, "insurance_claims_view");
    const hospitalId = session.payload.hospitalId;
    const { page, limit, skip } = getPagination(req.nextUrl.searchParams);
    const filter: Record<string, unknown> = { hospitalId };

    ["billId", "patientId", "status", "insuranceProvider"].forEach((key) => {
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
        { claimId: regex },
        { billId: regex },
        { insuranceProvider: regex },
        { policyNumber: regex },
        { patientId: { $in: patients.map((p) => p.patientId) } },
      ];
    }

    const [claims, total] = await Promise.all([
      InsuranceClaim.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      InsuranceClaim.countDocuments(filter),
    ]);

    const patientIds = [...new Set(claims.map((c) => c.patientId))];
    const patients = await Patient.find({ hospitalId, patientId: { $in: patientIds } }).select("patientId name phone");
    const patientMap = new Map(patients.map((p) => [p.patientId, p]));
    const enriched = claims.map((c) => ({
      ...c.toObject(),
      patient: patientMap.get(c.patientId) ?? null,
    }));

    return successResponse(serializeDoc(enriched), "Insurance claims fetched", 200, {
      page, limit, total, totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "insurance_claims_create");
    const hospitalId = session.payload.hospitalId;
    const body = claimCreateSchema.parse(await req.json());
    await connectDb();

    const bill = await Bill.findOne({ hospitalId, billId: body.billId });
    if (!bill) return errorResponse("Bill not found", 404);
    if (bill.status === "Cancelled") return errorResponse("Cannot create claim for cancelled bill", 400);

    const claim = await InsuranceClaim.create({
      hospitalId,
      claimId: await generateClaimId(hospitalId),
      billId: body.billId,
      patientId: bill.patientId,
      insuranceProvider: body.insuranceProvider,
      policyNumber: body.policyNumber,
      claimAmount: body.claimAmount,
      tpaName: body.tpaName ?? "",
      tpaReferenceNumber: body.tpaReferenceNumber ?? "",
      preAuthNumber: body.preAuthNumber ?? "",
      diagnosisCode: body.diagnosisCode ?? "",
      remarks: body.remarks ?? "",
      createdBy: session.payload.userId,
    });

    return successResponse(serializeDoc(claim), "Insurance claim created", 201);
  } catch (error) {
    return handleApiError(error);
  }
}
