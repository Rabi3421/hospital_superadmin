import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import {
  dateRangeFor,
  generateAppointmentId,
  generateTokenNumber,
  getPagination,
  validateAppointmentRefs,
} from "@/lib/hospital-clinical";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import Appointment from "@/models/Appointment";

const appointmentCreateSchema = z.object({
  patientId: z.string().min(1),
  doctorUserId: z.string().optional().or(z.literal("")),
  departmentId: z.string().optional().or(z.literal("")),
  appointmentDate: z.coerce.date(),
  appointmentTime: z.string().optional(),
  type: z.enum(["OPD", "Follow Up", "Emergency", "Online Request"]).optional(),
  source: z.enum(["Walk In", "Phone", "Online", "Follow Up"]).optional(),
  reason: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "appointments_view");
    const hospitalId = session.payload.hospitalId;
    await connectDb();

    const { page, limit, skip } = getPagination(req.nextUrl.searchParams);
    const filter: Record<string, unknown> = { hospitalId };
    const date = req.nextUrl.searchParams.get("date");

    if (date) filter.appointmentDate = dateRangeFor(date);
    ["doctorUserId", "departmentId", "status", "patientId"].forEach((key) => {
      const value = req.nextUrl.searchParams.get(key)?.trim();
      if (value) filter[key] = value;
    });
    if (session.user.role === "DOCTOR") filter.doctorUserId = session.payload.userId;

    const [appointments, total] = await Promise.all([
      Appointment.find(filter).sort({ appointmentDate: -1, tokenNumber: 1, createdAt: -1 }).skip(skip).limit(limit),
      Appointment.countDocuments(filter),
    ]);

    return successResponse(serializeDoc(appointments), "Appointments fetched", 200, {
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
    const session = await requireHospitalPermission(req, "appointments_create");
    const hospitalId = session.payload.hospitalId;
    const body = appointmentCreateSchema.parse(await req.json());
    await connectDb();

    await validateAppointmentRefs({
      hospitalId,
      patientId: body.patientId,
      doctorUserId: body.doctorUserId || undefined,
      departmentId: body.departmentId || undefined,
    });

    const appointment = await Appointment.create({
      ...body,
      hospitalId,
      appointmentId: await generateAppointmentId(hospitalId, body.appointmentDate),
      tokenNumber: await generateTokenNumber(hospitalId, body.appointmentDate),
      status: "Scheduled",
      type: body.type ?? "OPD",
      source: body.source ?? "Walk In",
      createdBy: session.payload.userId,
    });

    return successResponse(serializeDoc(appointment), "Appointment created", 201);
  } catch (error) {
    if (error instanceof Error && error.message.includes("E11000")) {
      return errorResponse("Appointment token already exists, please retry", 409);
    }
    return handleApiError(error);
  }
}
