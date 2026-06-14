import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { dateRangeFor, endOfDay, escapeRegex, getPagination, startOfDay } from "@/lib/hospital-clinical";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import { generateLabReportId } from "@/lib/hospital-lab";
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

const reportCreateSchema = z.object({
  labOrderId: z.string().min(1),
  patientId: z.string().min(1),
  results: z.array(resultSchema).min(1),
  summary: z.string().optional(),
  reportFileUrl: z.string().optional(),
});

function dateBetween(searchParams: URLSearchParams) {
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  if (dateFrom && dateTo) return { $gte: startOfDay(new Date(dateFrom)), $lte: endOfDay(new Date(dateTo)) };
  if (dateFrom) return { $gte: startOfDay(new Date(dateFrom)) };
  if (dateTo) return { $lte: endOfDay(new Date(dateTo)) };
  return null;
}

function validateResultsForOrder(results: z.infer<typeof resultSchema>[], orderTests: { testId?: string; testName: string }[]) {
  const allowedIds = new Set(orderTests.map((test) => test.testId).filter(Boolean));
  const allowedNames = new Set(orderTests.map((test) => test.testName));
  const invalid = results.some((result) => {
    if (result.testId) return !allowedIds.has(result.testId);
    return !allowedNames.has(result.testName);
  });
  if (invalid) throw new Error("Report results must map to tests in the lab order");
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "lab_reports_view");
    const hospitalId = session.payload.hospitalId;
    const { page, limit, skip } = getPagination(req.nextUrl.searchParams);
    const filter: Record<string, unknown> = { hospitalId };
    ["patientId", "labOrderId", "doctorUserId", "status"].forEach((key) => {
      const value = req.nextUrl.searchParams.get(key)?.trim();
      if (value) filter[key] = value;
    });
    if (session.user.role === "DOCTOR") filter.doctorUserId = session.payload.userId;
    const search = (req.nextUrl.searchParams.get("search") ?? req.nextUrl.searchParams.get("q"))?.trim();
    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ reportId: regex }, { labOrderId: regex }, { patientId: regex }];
    }
    const createdAt = dateBetween(req.nextUrl.searchParams);
    const date = req.nextUrl.searchParams.get("date");
    if (date) filter.createdAt = dateRangeFor(date);
    else if (createdAt) filter.createdAt = createdAt;

    await connectDb();
    const [reports, total] = await Promise.all([
      LabReport.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      LabReport.countDocuments(filter),
    ]);
    const patientIds = [...new Set(reports.map((report) => report.patientId))];
    const doctorIds = [...new Set(reports.map((report) => report.doctorUserId).filter((id): id is string => Boolean(id)))];
    const orderIds = [...new Set(reports.map((report) => report.labOrderId))];
    const [patients, doctors, orders] = await Promise.all([
      Patient.find({ hospitalId, patientId: { $in: patientIds } }).select("patientId name phone gender age status"),
      HospitalUser.find({ hospitalId, _id: { $in: doctorIds }, role: "DOCTOR" }).select("name phone role status"),
      LabOrder.find({ hospitalId, labOrderId: { $in: orderIds } }).select("labOrderId status priority tests"),
    ]);
    const patientById = new Map(patients.map((patient) => [patient.patientId, patient]));
    const doctorById = new Map(doctors.map((doctor) => [doctor._id.toString(), doctor]));
    const orderById = new Map(orders.map((order) => [order.labOrderId, order]));
    const enrichedReports = reports.map((report) => ({
      ...report.toObject(),
      patient: patientById.get(report.patientId) ?? null,
      doctor: report.doctorUserId ? doctorById.get(report.doctorUserId) ?? null : null,
      labOrder: orderById.get(report.labOrderId) ?? null,
    }));
    return successResponse(serializeDoc(enrichedReports), "Lab reports fetched", 200, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "lab_reports_create");
    const hospitalId = session.payload.hospitalId;
    const body = reportCreateSchema.parse(await req.json());
    await connectDb();

    const order = await LabOrder.findOne({ hospitalId, labOrderId: body.labOrderId });
    if (!order) return errorResponse("Lab order not found", 404);
    if (order.patientId !== body.patientId) return errorResponse("Patient does not match lab order", 409);
    const existing = await LabReport.findOne({ hospitalId, labOrderId: body.labOrderId, status: { $ne: "Cancelled" } });
    if (existing) return errorResponse("An active lab report already exists for this lab order", 409);
    validateResultsForOrder(body.results, order.tests);

    const report = await LabReport.create({
      hospitalId,
      reportId: await generateLabReportId(hospitalId),
      labOrderId: order.labOrderId,
      patientId: order.patientId,
      doctorUserId: order.doctorUserId ?? "",
      results: body.results.map((result) => ({ ...result, flag: result.flag ?? "Not Applicable" })),
      summary: body.summary ?? "",
      reportFileUrl: body.reportFileUrl ?? "",
      status: "Draft",
      preparedBy: session.payload.userId,
    });
    return successResponse(serializeDoc(report), "Lab report created", 201);
  } catch (error) {
    return handleApiError(error);
  }
}
