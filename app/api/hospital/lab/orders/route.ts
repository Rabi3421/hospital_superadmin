import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { dateRangeFor, endOfDay, escapeRegex, getPagination, startOfDay } from "@/lib/hospital-clinical";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import { generateLabOrderId, validateLabOrderTests } from "@/lib/hospital-lab";
import Appointment from "@/models/Appointment";
import Bill from "@/models/Bill";
import Consultation from "@/models/Consultation";
import HospitalUser from "@/models/HospitalUser";
import LabOrder from "@/models/LabOrder";
import LabReport from "@/models/LabReport";
import Patient from "@/models/Patient";
import Prescription from "@/models/Prescription";

const labOrderCreateSchema = z.object({
  patientId: z.string().min(1),
  appointmentId: z.string().optional().or(z.literal("")),
  consultationId: z.string().optional().or(z.literal("")),
  prescriptionId: z.string().optional().or(z.literal("")),
  doctorUserId: z.string().optional().or(z.literal("")),
  testIds: z.array(z.string().min(1)).min(1),
  priority: z.enum(["Routine", "Urgent"]).optional(),
  notes: z.string().optional(),
});

function dateBetween(searchParams: URLSearchParams) {
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  if (dateFrom && dateTo) return { $gte: startOfDay(new Date(dateFrom)), $lte: endOfDay(new Date(dateTo)) };
  if (dateFrom) return { $gte: startOfDay(new Date(dateFrom)) };
  if (dateTo) return { $lte: endOfDay(new Date(dateTo)) };
  return null;
}

async function validateRefs(hospitalId: string, body: z.infer<typeof labOrderCreateSchema>) {
  const [patient, appointment, consultation, prescription, doctor] = await Promise.all([
    Patient.findOne({ hospitalId, patientId: body.patientId }),
    body.appointmentId ? Appointment.findOne({ hospitalId, appointmentId: body.appointmentId }) : null,
    body.consultationId ? Consultation.findOne({ hospitalId, consultationId: body.consultationId }) : null,
    body.prescriptionId ? Prescription.findOne({ hospitalId, prescriptionId: body.prescriptionId }) : null,
    body.doctorUserId ? HospitalUser.findOne({ hospitalId, _id: body.doctorUserId, role: "DOCTOR" }) : null,
  ]);
  if (!patient) throw new Error("Patient not found");
  if (body.appointmentId && !appointment) throw new Error("Appointment not found");
  if (body.consultationId && !consultation) throw new Error("Consultation not found");
  if (body.prescriptionId && !prescription) throw new Error("Prescription not found");
  if (body.doctorUserId && !doctor) throw new Error("Doctor user not found for this hospital");
  if (appointment && appointment.patientId !== body.patientId) throw new Error("Appointment patient does not match lab order");
  if (consultation && consultation.patientId !== body.patientId) throw new Error("Consultation patient does not match lab order");
  if (prescription && prescription.patientId !== body.patientId) throw new Error("Prescription patient does not match lab order");
  if (prescription && body.doctorUserId && prescription.doctorUserId !== body.doctorUserId) {
    throw new Error("Prescription doctor does not match lab order");
  }
  if (consultation && body.doctorUserId && consultation.doctorUserId !== body.doctorUserId) {
    throw new Error("Consultation doctor does not match lab order");
  }
  if (appointment && consultation && consultation.appointmentId !== appointment.appointmentId) {
    throw new Error("Consultation appointment does not match lab order");
  }
  if (appointment && prescription && prescription.appointmentId !== appointment.appointmentId) {
    throw new Error("Prescription appointment does not match lab order");
  }
  if (consultation && prescription && prescription.consultationId !== consultation.consultationId) {
    throw new Error("Prescription consultation does not match lab order");
  }
  return { appointment, consultation, prescription };
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "lab_orders_view");
    const hospitalId = session.payload.hospitalId;
    const { page, limit, skip } = getPagination(req.nextUrl.searchParams);
    const filter: Record<string, unknown> = { hospitalId };
    ["patientId", "appointmentId", "consultationId", "prescriptionId", "doctorUserId", "status", "priority"].forEach((key) => {
      const value = req.nextUrl.searchParams.get(key)?.trim();
      if (value) filter[key] = value;
    });
    const search = (req.nextUrl.searchParams.get("search") ?? req.nextUrl.searchParams.get("q"))?.trim();
    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ labOrderId: regex }, { patientId: regex }, { prescriptionId: regex }];
    }
    const createdAt = dateBetween(req.nextUrl.searchParams);
    const date = req.nextUrl.searchParams.get("date");
    if (date) filter.createdAt = dateRangeFor(date);
    else if (createdAt) filter.createdAt = createdAt;

    await connectDb();
    const [orders, total] = await Promise.all([
      LabOrder.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      LabOrder.countDocuments(filter),
    ]);
    const patientIds = [...new Set(orders.map((order) => order.patientId))];
    const doctorIds = [...new Set(orders.map((order) => order.doctorUserId).filter((id): id is string => Boolean(id)))];
    const prescriptionIds = [...new Set(orders.map((order) => order.prescriptionId).filter((id): id is string => Boolean(id)))];
    const labOrderIds = orders.map((order) => order.labOrderId);
    const [patients, doctors, prescriptions, reports, bills] = await Promise.all([
      Patient.find({ hospitalId, patientId: { $in: patientIds } }).select("patientId name phone gender age status"),
      HospitalUser.find({ hospitalId, _id: { $in: doctorIds }, role: "DOCTOR" }).select("name phone role status"),
      Prescription.find({ hospitalId, prescriptionId: { $in: prescriptionIds } }).select("prescriptionId status issuedAt"),
      LabReport.find({ hospitalId, labOrderId: { $in: labOrderIds } }).select("reportId labOrderId status publishedAt"),
      Bill.find({ hospitalId, sourceType: "LabOrder", sourceId: { $in: labOrderIds } }).select(
        "billId sourceId status grandTotal dueAmount",
      ),
    ]);
    const patientById = new Map(patients.map((patient) => [patient.patientId, patient]));
    const doctorById = new Map(doctors.map((doctor) => [doctor._id.toString(), doctor]));
    const prescriptionById = new Map(prescriptions.map((prescription) => [prescription.prescriptionId, prescription]));
    const reportByOrderId = new Map(reports.map((report) => [report.labOrderId, report]));
    const billByOrderId = new Map(bills.map((bill) => [bill.sourceId, bill]));
    const enrichedOrders = orders.map((order) => ({
      ...order.toObject(),
      patient: patientById.get(order.patientId) ?? null,
      doctor: order.doctorUserId ? doctorById.get(order.doctorUserId) ?? null : null,
      prescription: order.prescriptionId ? prescriptionById.get(order.prescriptionId) ?? null : null,
      report: reportByOrderId.get(order.labOrderId) ?? null,
      bill: billByOrderId.get(order.labOrderId) ?? null,
    }));
    return successResponse(serializeDoc(enrichedOrders), "Lab orders fetched", 200, {
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
    const session = await requireHospitalPermission(req, "lab_orders_create");
    const hospitalId = session.payload.hospitalId;
    const body = labOrderCreateSchema.parse(await req.json());
    await connectDb();

    const refs = await validateRefs(hospitalId, body);
    const tests = await validateLabOrderTests(body.testIds, hospitalId);
    const order = await LabOrder.create({
      hospitalId,
      labOrderId: await generateLabOrderId(hospitalId),
      patientId: body.patientId,
      appointmentId: body.appointmentId ?? "",
      consultationId: body.consultationId ?? "",
      prescriptionId: body.prescriptionId ?? "",
      doctorUserId:
        body.doctorUserId ||
        refs.prescription?.doctorUserId ||
        refs.consultation?.doctorUserId ||
        refs.appointment?.doctorUserId ||
        "",
      tests,
      status: "Ordered",
      priority: body.priority ?? "Routine",
      notes: body.notes ?? "",
      createdBy: session.payload.userId,
    });

    return successResponse(serializeDoc(order), "Lab order created", 201);
  } catch (error) {
    if (error instanceof Error && ["Patient not found", "Appointment not found", "Consultation not found", "Prescription not found"].includes(error.message)) {
      return errorResponse(error.message, 404);
    }
    if (error instanceof Error && error.message.includes("does not match lab order")) {
      return errorResponse(error.message, 409);
    }
    return handleApiError(error);
  }
}
