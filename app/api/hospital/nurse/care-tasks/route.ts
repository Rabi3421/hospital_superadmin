import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { endOfDay, getPagination, startOfDay } from "@/lib/hospital-clinical";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import { generateCareTaskId } from "@/lib/hospital-nurse";
import Appointment from "@/models/Appointment";
import NurseCareTask from "@/models/NurseCareTask";
import Patient from "@/models/Patient";

const careTaskCreateSchema = z.object({
  patientId: z.string().min(1),
  appointmentId: z.string().optional().or(z.literal("")),
  assignedNurseId: z.string().optional().or(z.literal("")),
  taskType: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  priority: z.string().optional(),
  dueAt: z.string().optional(),
});

function dateBetween(searchParams: URLSearchParams) {
  const fromDate = searchParams.get("fromDate");
  const toDate = searchParams.get("toDate");
  if (fromDate && toDate) return { $gte: startOfDay(new Date(fromDate)), $lte: endOfDay(new Date(toDate)) };
  if (fromDate) return { $gte: startOfDay(new Date(fromDate)) };
  if (toDate) return { $lte: endOfDay(new Date(toDate)) };
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "nurse_care_tasks_view");
    const hospitalId = session.payload.hospitalId;
    const { page, limit, skip } = getPagination(req.nextUrl.searchParams);
    const filter: Record<string, unknown> = { hospitalId };

    ["patientId", "appointmentId", "assignedNurseId", "taskType", "priority", "status"].forEach((key) => {
      const value = req.nextUrl.searchParams.get(key)?.trim();
      if (value) filter[key] = value;
    });

    if (session.user.role === "NURSE") filter.assignedNurseId = session.payload.userId;

    const createdAt = dateBetween(req.nextUrl.searchParams);
    if (createdAt) filter.createdAt = createdAt;

    await connectDb();
    const [tasks, total] = await Promise.all([
      NurseCareTask.find(filter).sort({ dueAt: 1, createdAt: -1 }).skip(skip).limit(limit),
      NurseCareTask.countDocuments(filter),
    ]);

    const patientIds = [...new Set(tasks.map((t) => t.patientId))];
    const patients = await Patient.find({ hospitalId, patientId: { $in: patientIds } }).select("patientId name phone");
    const patientMap = new Map(patients.map((p) => [p.patientId, p]));

    const enriched = tasks.map((task) => ({
      ...task.toObject(),
      patient: patientMap.get(task.patientId) ? serializeDoc(patientMap.get(task.patientId)) : null,
    }));

    return successResponse(serializeDoc(enriched), "Care tasks fetched", 200, {
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
    const session = await requireHospitalPermission(req, "nurse_care_tasks_create");
    const hospitalId = session.payload.hospitalId;
    const body = careTaskCreateSchema.parse(await req.json());
    await connectDb();

    const patient = await Patient.findOne({ hospitalId, patientId: body.patientId });
    if (!patient) return errorResponse("Patient not found", 404);

    if (body.appointmentId) {
      const appointment = await Appointment.findOne({ hospitalId, appointmentId: body.appointmentId });
      if (!appointment) return errorResponse("Appointment not found", 404);
      if (appointment.patientId !== body.patientId) return errorResponse("Appointment patient does not match", 409);
    }

    const task = await NurseCareTask.create({
      hospitalId,
      taskId: await generateCareTaskId(hospitalId),
      patientId: body.patientId,
      appointmentId: body.appointmentId || "",
      assignedNurseId: body.assignedNurseId || session.payload.userId,
      assignedBy: session.payload.userId,
      taskType: body.taskType ?? "General",
      title: body.title,
      description: body.description ?? "",
      priority: body.priority ?? "Normal",
      dueAt: body.dueAt ? new Date(body.dueAt) : undefined,
      status: "Pending",
    } as Record<string, unknown>);

    return successResponse(serializeDoc(task), "Care task created", 201);
  } catch (error) {
    return handleApiError(error);
  }
}
