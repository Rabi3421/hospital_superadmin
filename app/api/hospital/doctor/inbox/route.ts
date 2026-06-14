import { NextRequest } from "next/server";
import { handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import LabReport from "@/models/LabReport";
import Patient from "@/models/Patient";
import Prescription from "@/models/Prescription";

export async function GET(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "doctor_queue_view");
    const hospitalId = session.payload.hospitalId;
    const doctorUserId = session.payload.userId;
    const now = new Date();
    const upcoming = new Date(now);
    upcoming.setDate(upcoming.getDate() + 14);
    await connectDb();

    const [reports, followUps] = await Promise.all([
      LabReport.find({
        hospitalId,
        doctorUserId,
        status: "Published",
        reviewedByDoctorAt: { $exists: false },
      })
        .sort({ publishedAt: -1, createdAt: -1 })
        .limit(50),
      Prescription.find({
        hospitalId,
        doctorUserId,
        status: "Issued",
        followUpDate: { $lte: upcoming },
      })
        .sort({ followUpDate: 1 })
        .limit(50),
    ]);

    const patientIds = [
      ...new Set([...reports.map((item) => item.patientId), ...followUps.map((item) => item.patientId)]),
    ];
    const patients = await Patient.find({ hospitalId, patientId: { $in: patientIds } }).select(
      "patientId name phone gender age allergies status",
    );
    const patientById = new Map(patients.map((patient) => [patient.patientId, patient]));
    const enrichedReports = reports.map((report) => ({
      ...report.toObject(),
      patient: patientById.get(report.patientId) ?? null,
      criticalResultCount: report.results.filter((result) => result.flag === "Critical").length,
      abnormalResultCount: report.results.filter((result) => ["High", "Low", "Critical"].includes(result.flag)).length,
    }));
    const enrichedFollowUps = followUps.map((prescription) => ({
      ...prescription.toObject(),
      patient: patientById.get(prescription.patientId) ?? null,
      overdue: Boolean(prescription.followUpDate && prescription.followUpDate < now),
    }));

    return successResponse(
      serializeDoc({
        reports: enrichedReports,
        followUps: enrichedFollowUps,
        counts: {
          pendingResults: enrichedReports.length,
          criticalResults: enrichedReports.filter((report) => report.criticalResultCount > 0).length,
          overdueFollowUps: enrichedFollowUps.filter((followUp) => followUp.overdue).length,
          upcomingFollowUps: enrichedFollowUps.filter((followUp) => !followUp.overdue).length,
        },
      }),
      "Doctor clinical inbox fetched",
    );
  } catch (error) {
    return handleApiError(error);
  }
}
