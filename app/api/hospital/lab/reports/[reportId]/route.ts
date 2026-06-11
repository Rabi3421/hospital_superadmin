import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import HospitalDoctorPublicProfile from "@/models/HospitalDoctorPublicProfile";
import HospitalUser from "@/models/HospitalUser";
import LabOrder from "@/models/LabOrder";
import LabReport from "@/models/LabReport";
import Patient from "@/models/Patient";

const resultSchema = z.object({
  testId: z.string().optional().or(z.literal("")),
  testName: z.string().min(1),
  value: z.string().optional(),
  unit: z.string().optional(),
  normalRange: z.string().optional(),
  flag: z.enum(["Normal", "High", "Low", "Critical", "Not Applicable"]).optional(),
  remarks: z.string().optional(),
});

const reportUpdateSchema = z.object({
  results: z.array(resultSchema).min(1).optional(),
  summary: z.string().optional(),
  reportFileUrl: z.string().optional(),
});

type RouteContext = { params: Promise<{ reportId: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "lab_reports_view");
    const { reportId } = await context.params;
    await connectDb();
    const report = await LabReport.findOne({ hospitalId: session.payload.hospitalId, reportId });
    if (!report) return errorResponse("Lab report not found", 404);
    const hospitalId = session.payload.hospitalId;
    const [labOrder, patient, doctor, doctorProfile] = await Promise.all([
      LabOrder.findOne({ hospitalId, labOrderId: report.labOrderId }),
      Patient.findOne({ hospitalId, patientId: report.patientId }).select("patientId name phone email gender age status"),
      report.doctorUserId
        ? HospitalUser.findOne({ hospitalId, _id: report.doctorUserId, role: "DOCTOR" }).select("name email phone role status")
        : null,
      report.doctorUserId
        ? HospitalDoctorPublicProfile.findOne({ hospitalId, userId: report.doctorUserId }).select("specialization qualification")
        : null,
    ]);
    const compactDoctor = doctor
      ? { ...doctor.toObject(), specialization: doctorProfile?.specialization ?? "" }
      : null;
    return successResponse(
      serializeDoc({ ...report.toObject(), labOrder, patient, doctor: compactDoctor }),
      "Lab report fetched",
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "lab_reports_update");
    const { reportId } = await context.params;
    const body = reportUpdateSchema.parse(await req.json());
    await connectDb();
    const report = await LabReport.findOne({ hospitalId: session.payload.hospitalId, reportId });
    if (!report) return errorResponse("Lab report not found", 404);
    if (report.status !== "Draft") return errorResponse("Only draft lab reports can be edited", 409);
    if (body.results) {
      const order = await LabOrder.findOne({ hospitalId: session.payload.hospitalId, labOrderId: report.labOrderId });
      if (!order) return errorResponse("Lab order not found", 404);
      const allowedIds = new Set(order.tests.map((test) => test.testId).filter(Boolean));
      const allowedNames = new Set(order.tests.map((test) => test.testName));
      const invalid = body.results.some((result) =>
        result.testId ? !allowedIds.has(result.testId) : !allowedNames.has(result.testName),
      );
      if (invalid) return errorResponse("Report results must map to tests in the lab order", 409);
      report.results = body.results.map((result) => ({ ...result, flag: result.flag ?? "Not Applicable" }));
    }
    if (body.summary !== undefined) report.summary = body.summary;
    if (body.reportFileUrl !== undefined) report.reportFileUrl = body.reportFileUrl;
    await report.save();
    return successResponse(serializeDoc(report), "Lab report updated");
  } catch (error) {
    return handleApiError(error);
  }
}
