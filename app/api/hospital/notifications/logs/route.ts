import { NextRequest } from "next/server";
import { handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { endOfDay, getPagination, startOfDay } from "@/lib/hospital-clinical";
import { requireHospitalRole } from "@/lib/hospital-auth";
import NotificationLog from "@/models/NotificationLog";

export async function GET(req: NextRequest) {
  try {
    const session = await requireHospitalRole(req, ["HOSPITAL_ADMIN", "MANAGING_DIRECTOR"]);
    const hospitalId = session.payload.hospitalId;
    const { page, limit, skip } = getPagination(req.nextUrl.searchParams);
    const filter: Record<string, unknown> = { hospitalId };

    ["eventType", "channel", "status", "patientId", "appointmentId"].forEach((key) => {
      const value = req.nextUrl.searchParams.get(key)?.trim();
      if (value) filter[key] = value;
    });

    const fromDate = req.nextUrl.searchParams.get("fromDate")?.trim();
    const toDate = req.nextUrl.searchParams.get("toDate")?.trim();
    if (fromDate || toDate) {
      const createdAt: Record<string, Date> = {};
      if (fromDate) createdAt.$gte = startOfDay(new Date(fromDate));
      if (toDate) createdAt.$lte = endOfDay(new Date(toDate));
      filter.createdAt = createdAt;
    }

    await connectDb();
    const [logs, total] = await Promise.all([
      NotificationLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      NotificationLog.countDocuments(filter),
    ]);

    return successResponse(serializeDoc(logs), "Notification logs fetched", 200, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
