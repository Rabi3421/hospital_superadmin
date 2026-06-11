import { NextRequest } from "next/server";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { doctorMapFor, requirePatientAuth } from "@/lib/hospital-patient";
import LabOrder from "@/models/LabOrder";
import LabReport from "@/models/LabReport";

type RouteContext = { params: Promise<{ reportId: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const session = await requirePatientAuth(req);
    const { reportId } = await context.params;
    await connectDb();
    const report = await LabReport.findOne({
      hospitalId: session.payload.hospitalId,
      patientId: session.patient.patientId,
      reportId,
      status: "Published",
    });
    if (!report) return errorResponse("Lab report not found", 404);
    const [doctorById, labOrder] = await Promise.all([
      doctorMapFor(session.payload.hospitalId, [report.doctorUserId ?? ""]),
      LabOrder.findOne({ hospitalId: session.payload.hospitalId, patientId: session.patient.patientId, labOrderId: report.labOrderId }).select(
        "labOrderId tests status priority prescriptionId appointmentId consultationId",
      ),
    ]);

    return successResponse(
      serializeDoc({
        reportId: report.reportId,
        labOrderId: report.labOrderId,
        doctor: report.doctorUserId ? doctorById.get(report.doctorUserId) ?? null : null,
        labOrder,
        results: report.results,
        remarks: report.summary,
        attachments: report.reportFileUrl ? [{ url: report.reportFileUrl }] : [],
        publishedAt: report.publishedAt,
        createdAt: report.createdAt,
      }),
      "Patient lab report fetched",
    );
  } catch (error) {
    return handleApiError(error);
  }
}
