import { NextRequest } from "next/server";
import { handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { doctorMapFor, patientListPagination, requirePatientAuth } from "@/lib/hospital-patient";
import LabOrder from "@/models/LabOrder";
import LabReport from "@/models/LabReport";

export async function GET(req: NextRequest) {
  try {
    const session = await requirePatientAuth(req);
    const { page, limit, skip } = patientListPagination(req.nextUrl.searchParams);
    const filter = { hospitalId: session.payload.hospitalId, patientId: session.patient.patientId, status: "Published" as const };
    await connectDb();
    const [reports, total] = await Promise.all([
      LabReport.find(filter).sort({ publishedAt: -1, createdAt: -1 }).skip(skip).limit(limit),
      LabReport.countDocuments(filter),
    ]);
    const [doctorById, orders] = await Promise.all([
      doctorMapFor(session.payload.hospitalId, reports.map((report) => report.doctorUserId ?? "")),
      LabOrder.find({ hospitalId: session.payload.hospitalId, labOrderId: { $in: reports.map((report) => report.labOrderId) } }).select(
        "labOrderId tests status priority prescriptionId appointmentId consultationId",
      ),
    ]);
    const orderById = new Map(orders.map((order) => [order.labOrderId, order]));

    return successResponse(
      serializeDoc(reports.map((report) => ({
        reportId: report.reportId,
        labOrderId: report.labOrderId,
        doctor: report.doctorUserId ? doctorById.get(report.doctorUserId) ?? null : null,
        labOrder: orderById.get(report.labOrderId) ?? null,
        results: report.results,
        remarks: report.summary,
        attachments: report.reportFileUrl ? [{ url: report.reportFileUrl }] : [],
        publishedAt: report.publishedAt,
        createdAt: report.createdAt,
      }))),
      "Patient lab reports fetched",
      200,
      { page, limit, total, totalPages: Math.ceil(total / limit) },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
