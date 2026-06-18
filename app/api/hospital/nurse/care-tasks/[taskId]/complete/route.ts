import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import NurseCareTask from "@/models/NurseCareTask";

const completeSchema = z.object({
  completionNotes: z.string().optional(),
});

type RouteContext = { params: Promise<{ taskId: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "nurse_care_tasks_complete");
    const { taskId } = await context.params;
    const hospitalId = session.payload.hospitalId;
    const body = completeSchema.parse(await req.json());
    await connectDb();

    const filter: Record<string, unknown> = { hospitalId, taskId };
    if (session.user.role === "NURSE") filter.assignedNurseId = session.payload.userId;
    const task = await NurseCareTask.findOne(filter);
    if (!task) return errorResponse("Care task not found", 404);

    if (task.status === "Completed") return errorResponse("Task is already completed", 409);
    if (task.status === "Cancelled") return errorResponse("Cannot complete a cancelled task", 409);

    task.status = "Completed";
    task.completedAt = new Date();
    if (body.completionNotes) task.completionNotes = body.completionNotes;
    await task.save();

    return successResponse(serializeDoc(task), "Care task completed");
  } catch (error) {
    return handleApiError(error);
  }
}
