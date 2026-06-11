import { NextRequest } from "next/server";
import { handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { applyPatientDateFilters, patientListPagination, requirePatientAuth } from "@/lib/hospital-patient";
import Bill from "@/models/Bill";

export async function GET(req: NextRequest) {
  try {
    const session = await requirePatientAuth(req);
    const { page, limit, skip } = patientListPagination(req.nextUrl.searchParams);
    const filter: Record<string, unknown> = {
      hospitalId: session.payload.hospitalId,
      patientId: session.patient.patientId,
      status: { $ne: "Draft" },
    };
    const status = req.nextUrl.searchParams.get("status")?.trim();
    if (status) filter.status = status;
    applyPatientDateFilters(filter, req.nextUrl.searchParams);
    await connectDb();
    const [bills, total] = await Promise.all([
      Bill.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Bill.countDocuments(filter),
    ]);

    return successResponse(serializeDoc(bills), "Patient bills fetched", 200, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
