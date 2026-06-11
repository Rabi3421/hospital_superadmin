import { NextRequest } from "next/server";
import { handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { patientListPagination, requirePatientAuth } from "@/lib/hospital-patient";
import LabOrder from "@/models/LabOrder";

export async function GET(req: NextRequest) {
  try {
    const session = await requirePatientAuth(req);
    const { page, limit, skip } = patientListPagination(req.nextUrl.searchParams);
    const visibleStatuses = ["Ordered", "Sample Collected", "Processing", "Ready", "Completed"];
    const status = req.nextUrl.searchParams.get("status")?.trim();
    const filter: Record<string, unknown> = {
      hospitalId: session.payload.hospitalId,
      patientId: session.patient.patientId,
      status: visibleStatuses.includes(status ?? "") ? status : { $in: visibleStatuses },
    };
    await connectDb();
    const [orders, total] = await Promise.all([
      LabOrder.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      LabOrder.countDocuments(filter),
    ]);
    return successResponse(serializeDoc(orders), "Patient lab orders fetched", 200, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
