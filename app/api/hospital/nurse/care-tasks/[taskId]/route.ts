import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import NurseCareTask from "@/models/NurseCareTask";
import Patient from "@/models/Patient";

const careTaskUpdateSchema = z.object({
  assignedNurseId: z.string().optional(),
  taskType: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  priority: z.string().optional(),
  dueAt: z.string().optional(),
  status: z.string().optional(),
});

type RouteContext = { params: Promise<{ taskId: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "nurse_care_tasks_view");
    const { taskId } = await context.params;
    const hospitalId = session.payload.hospitalId;
    await connectDb();

    const filter: Record<string, unknown> = { hospitalId, taskId };
    if (session.user.role === "NURSE") filter.assignedNurseId = session.payload.userId;
    const task = await NurseCareTask.findOne(filter);
    if (!task) return errorResponse("Care task not found", 404);

    const patient = await Patient.findOne({ hospitalId, patientId: task.patientId }).select(
      "patientId name phone email gender age status",
    );

    return successResponse(
      serializeDoc({ ...task.toObject(), patient }),
      "Care task fetched",
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "nurse_care_tasks_update");
    const { taskId } = await context.params;
    const hospitalId = session.payload.hospitalId;
    const body = careTaskUpdateSchema.parse(await req.json());
    await connectDb();

    const filter: Record<string, unknown> = { hospitalId, taskId };
    if (session.user.role === "NURSE") filter.assignedNurseId = session.payload.userId;
    const task = await NurseCareTask.findOne(filter);
    if (!task) return errorResponse("Care task not found", 404);

    if (body.assignedNurseId !== undefined) task.assignedNurseId = body.assignedNurseId;
    if (body.taskType !== undefined) task.taskType = body.taskType as any;
    if (body.title !== undefined) task.title = body.title;
    if (body.description !== undefined) task.description = body.description;
    if (body.priority !== undefined) task.priority = body.priority as any;
    if (body.dueAt !== undefined) task.dueAt = new Date(body.dueAt);
    if (body.status !== undefined) task.status = body.status as any;

    task.updatedBy = session.payload.userId;
    await task.save();

    return successResponse(serializeDoc(task), "Care task updated");
  } catch (error) {
    return handleApiError(error);
  }
}
