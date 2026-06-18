import { NextRequest } from "next/server";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requireHospitalRole } from "@/lib/hospital-auth";
import NotificationLog from "@/models/NotificationLog";

type RouteContext = { params: Promise<{ notificationId: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalRole(req, ["HOSPITAL_ADMIN", "MANAGING_DIRECTOR"]);
    const { notificationId } = await context.params;
    await connectDb();

    const log = await NotificationLog.findOne({
      hospitalId: session.payload.hospitalId,
      notificationId,
    });
    if (!log) return errorResponse("Notification log not found", 404);

    return successResponse(serializeDoc(log), "Notification log fetched");
  } catch (error) {
    return handleApiError(error);
  }
}
