import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import NursingNote from "@/models/NursingNote";
import Patient from "@/models/Patient";

const noteUpdateSchema = z.object({
  noteType: z.string().optional(),
  priority: z.string().optional(),
  title: z.string().optional(),
  note: z.string().optional(),
  patientVisible: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ noteId: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "nursing_notes_view");
    const { noteId } = await context.params;
    const hospitalId = session.payload.hospitalId;
    await connectDb();

    const filter: Record<string, unknown> = { hospitalId, noteId };
    if (session.user.role === "NURSE") filter.nurseUserId = session.payload.userId;
    const nursingNote = await NursingNote.findOne(filter);
    if (!nursingNote) return errorResponse("Nursing note not found", 404);

    const patient = await Patient.findOne({ hospitalId, patientId: nursingNote.patientId }).select(
      "patientId name phone email gender age status",
    );

    return successResponse(
      serializeDoc({ ...nursingNote.toObject(), patient }),
      "Nursing note fetched",
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "nursing_notes_update");
    const { noteId } = await context.params;
    const hospitalId = session.payload.hospitalId;
    const body = noteUpdateSchema.parse(await req.json());
    await connectDb();

    const filter: Record<string, unknown> = { hospitalId, noteId };
    if (session.user.role === "NURSE") filter.nurseUserId = session.payload.userId;
    const nursingNote = await NursingNote.findOne(filter);
    if (!nursingNote) return errorResponse("Nursing note not found", 404);

    if (nursingNote.status !== "Active") {
      return errorResponse("Only active nursing notes can be edited", 409);
    }

    let noteContentChanged = false;
    if (body.noteType !== undefined) nursingNote.noteType = body.noteType as any;
    if (body.priority !== undefined) nursingNote.priority = body.priority as any;
    if (body.title !== undefined) nursingNote.title = body.title;
    if (body.note !== undefined) {
      nursingNote.note = body.note;
      noteContentChanged = true;
    }
    if (body.patientVisible !== undefined) nursingNote.patientVisible = body.patientVisible;

    if (noteContentChanged) nursingNote.status = "Edited";
    nursingNote.updatedBy = session.payload.userId;
    await nursingNote.save();

    return successResponse(serializeDoc(nursingNote), "Nursing note updated");
  } catch (error) {
    return handleApiError(error);
  }
}
