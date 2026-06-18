import { NextRequest } from "next/server";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import { sendEventNotification } from "@/lib/notifications/notification-service";
import LabOrder from "@/models/LabOrder";
import LabReport from "@/models/LabReport";
import Patient from "@/models/Patient";

type RouteContext = { params: Promise<{ reportId: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "lab_reports_publish");
    const { reportId } = await context.params;
    await connectDb();
    const report = await LabReport.findOne({ hospitalId: session.payload.hospitalId, reportId });
    if (!report) return errorResponse("Lab report not found", 404);
    if (report.status !== "Draft") return errorResponse("Only draft lab reports can be published", 409);
    report.status = "Published";
    report.publishedAt = new Date();
    await report.save();

    const order = await LabOrder.findOne({ hospitalId: session.payload.hospitalId, labOrderId: report.labOrderId });
    if (order && !["Ready", "Completed"].includes(order.status)) {
      order.status = "Ready";
      order.readyAt = order.readyAt ?? new Date();
      order.tests = order.tests.map((test) => ({ ...test, status: "Ready" }));
      await order.save();
    }
    // Fire-and-forget notification
    try {
      const hospitalId = session.payload.hospitalId;
      const patient = await Patient.findOne({ hospitalId, patientId: report.patientId }).select("name phone");
      if (patient?.phone) {
        void sendEventNotification({
          hospitalId,
          eventType: "LAB_REPORT_READY",
          recipient: {
            type: "PATIENT",
            name: patient.name,
            phone: patient.phone,
            patientId: report.patientId,
          },
          context: {
            patientName: patient.name,
            hospitalName: session.hospital.name,
          },
          relatedIds: { labReportId: reportId },
        }).catch(() => {});
      }
    } catch {}

    return successResponse(serializeDoc(report), "Lab report published");
  } catch (error) {
    return handleApiError(error);
  }
}
