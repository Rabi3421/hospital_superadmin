import { NextRequest } from "next/server";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import LabReport from "@/models/LabReport";

type RouteContext = { params: Promise<{ reportId: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "lab_reports_view");
    const { reportId } = await context.params;
    await connectDb();
    const report = await LabReport.findOne({
      hospitalId: session.payload.hospitalId,
      reportId,
      doctorUserId: session.payload.userId,
      status: "Published",
    });
    if (!report) return errorResponse("Published lab report not found", 404);
    if (!report.reviewedByDoctorAt) {
      report.reviewedByDoctorAt = new Date();
      report.reviewedByDoctorId = session.payload.userId;
      await report.save();
    }
    return successResponse(serializeDoc(report), "Lab report marked as reviewed");
  } catch (error) {
    return handleApiError(error);
  }
}
