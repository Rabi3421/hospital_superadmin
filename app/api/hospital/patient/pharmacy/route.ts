import { NextRequest } from "next/server";
import { handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { patientListPagination, requirePatientAuth } from "@/lib/hospital-patient";
import PharmacySale from "@/models/PharmacySale";

export async function GET(req: NextRequest) {
  try {
    const session = await requirePatientAuth(req);
    const { page, limit, skip } = patientListPagination(req.nextUrl.searchParams);
    const filter: Record<string, unknown> = {
      hospitalId: session.payload.hospitalId,
      patientId: session.patient.patientId,
    };
    const status = req.nextUrl.searchParams.get("status")?.trim();
    if (status) filter.saleStatus = status;
    await connectDb();
    const [sales, total] = await Promise.all([
      PharmacySale.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      PharmacySale.countDocuments(filter),
    ]);
    return successResponse(serializeDoc(sales), "Patient pharmacy history fetched", 200, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
