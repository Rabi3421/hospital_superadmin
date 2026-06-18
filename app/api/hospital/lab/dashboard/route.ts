import { NextRequest } from "next/server";
import { handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { dateRangeFor } from "@/lib/hospital-clinical";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import LabOrder from "@/models/LabOrder";
import LabReport from "@/models/LabReport";
import LabTest from "@/models/LabTest";
import Patient from "@/models/Patient";

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
      pendingOrdersCount,
      sampleCollected,
      processing,
      ready,
      completed,
      urgentOrdersCount,
      reportsDraft,
      reportsPublishedToday,
      pendingOrdersList,
      urgentOrdersList,
      readyOrdersList,
      recentReports,
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
      LabOrder.find({ hospitalId, status: "Ordered" }).sort({ createdAt: -1 }).limit(10).select(
        "labOrderId patientId status priority notes createdAt",
      ),
      LabOrder.find({ hospitalId, priority: "Urgent", status: { $nin: ["Completed", "Cancelled"] } }).sort({ createdAt: -1 }).limit(10).select(
        "labOrderId patientId status priority notes createdAt",
      ),
      LabOrder.find({ hospitalId, status: "Ready" }).sort({ readyAt: -1, createdAt: -1 }).limit(10).select(
        "labOrderId patientId status priority readyAt createdAt",
      ),
      LabReport.find({ hospitalId, status: "Draft" }).sort({ createdAt: -1 }).limit(10).select(
        "reportId labOrderId patientId status createdAt",
      ),
    ]);

    const allPatientIds = [
      ...new Set([
        ...pendingOrdersList.map((o) => o.patientId),
        ...urgentOrdersList.map((o) => o.patientId),
        ...readyOrdersList.map((o) => o.patientId),
        ...recentReports.map((r) => r.patientId),
      ]),
    ];
    const patients = await Patient.find({ hospitalId, patientId: { $in: allPatientIds } }).select("patientId name phone");
    const patientMap = new Map(patients.map((p) => [p.patientId, p]));

    function enrichWithPatient<T extends { patientId: string }>(docs: T[]) {
      return docs.map((doc) => ({
        ...serializeDoc(doc),
        patient: patientMap.get(doc.patientId) ? serializeDoc(patientMap.get(doc.patientId)) : null,
      }));
    }

    return successResponse({
      totalTests,
      activeTests,
      ordersToday,
      pendingOrders: pendingOrdersCount,
      sampleCollected,
      processing,
      ready,
      completed,
      urgentOrders: urgentOrdersCount,
      reportsDraft,
      reportsPublishedToday,
      todayOrders: ordersToday,
      sampleCollectedToday: sampleCollected,
      processingOrders: processing,
      readyReports: ready,
      completedToday: completed,
      draftReports: reportsDraft,
      publishedReportsToday: reportsPublishedToday,
      pendingOrdersList: enrichWithPatient(pendingOrdersList),
      urgentOrdersList: enrichWithPatient(urgentOrdersList),
      readyOrdersList: enrichWithPatient(readyOrdersList),
      recentReportsList: enrichWithPatient(recentReports),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
