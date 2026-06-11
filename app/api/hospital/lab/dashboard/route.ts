import { NextRequest } from "next/server";
import { handleApiError, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { dateRangeFor } from "@/lib/hospital-clinical";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import LabOrder from "@/models/LabOrder";
import LabReport from "@/models/LabReport";
import LabTest from "@/models/LabTest";

export async function GET(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "lab_dashboard_view");
    const hospitalId = session.payload.hospitalId;
    const today = dateRangeFor(new Date());
    await connectDb();

    const [
      totalTests,
      activeTests,
      ordersToday,
      pendingOrders,
      sampleCollected,
      processing,
      ready,
      completed,
      urgentOrders,
      reportsDraft,
      reportsPublishedToday,
    ] = await Promise.all([
      LabTest.countDocuments({ hospitalId }),
      LabTest.countDocuments({ hospitalId, status: "Active" }),
      LabOrder.countDocuments({ hospitalId, createdAt: today }),
      LabOrder.countDocuments({ hospitalId, status: "Ordered" }),
      LabOrder.countDocuments({ hospitalId, status: "Sample Collected" }),
      LabOrder.countDocuments({ hospitalId, status: "Processing" }),
      LabOrder.countDocuments({ hospitalId, status: "Ready" }),
      LabOrder.countDocuments({ hospitalId, status: "Completed" }),
      LabOrder.countDocuments({ hospitalId, priority: "Urgent", status: { $nin: ["Completed", "Cancelled"] } }),
      LabReport.countDocuments({ hospitalId, status: "Draft" }),
      LabReport.countDocuments({ hospitalId, publishedAt: today, status: "Published" }),
    ]);

    return successResponse({
      totalTests,
      activeTests,
      ordersToday,
      pendingOrders,
      sampleCollected,
      processing,
      ready,
      completed,
      urgentOrders,
      reportsDraft,
      reportsPublishedToday,
      todayOrders: ordersToday,
      sampleCollectedToday: sampleCollected,
      processingOrders: processing,
      readyReports: ready,
      completedToday: completed,
      draftReports: reportsDraft,
      publishedReportsToday: reportsPublishedToday,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
