import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { endOfDay, getPagination, startOfDay } from "@/lib/hospital-clinical";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import { generateNursingNoteId } from "@/lib/hospital-nurse";
import Appointment from "@/models/Appointment";
import NursingNote from "@/models/NursingNote";
import Patient from "@/models/Patient";

const noteCreateSchema = z.object({
  patientId: z.string().min(1),
  appointmentId: z.string().optional().or(z.literal("")),
  noteType: z.string().optional(),
  priority: z.string().optional(),
  title: z.string().optional(),
  note: z.string().min(1),
  patientVisible: z.boolean().optional(),
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
    const session = await requireHospitalPermission(req, "nursing_notes_view");
    const hospitalId = session.payload.hospitalId;
    const { page, limit, skip } = getPagination(req.nextUrl.searchParams);
    const filter: Record<string, unknown> = { hospitalId };

    ["patientId", "appointmentId", "nurseUserId", "noteType", "priority"].forEach((key) => {
      const value = req.nextUrl.searchParams.get(key)?.trim();
      if (value) filter[key] = value;
    });

    if (session.user.role === "NURSE") filter.nurseUserId = session.payload.userId;

    const createdAt = dateBetween(req.nextUrl.searchParams);
    if (createdAt) filter.createdAt = createdAt;

    await connectDb();
    const [notes, total] = await Promise.all([
      NursingNote.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      NursingNote.countDocuments(filter),
    ]);

    const patientIds = [...new Set(notes.map((n) => n.patientId))];
    const patients = await Patient.find({ hospitalId, patientId: { $in: patientIds } }).select("patientId name phone");
    const patientMap = new Map(patients.map((p) => [p.patientId, p]));

    const enriched = notes.map((note) => ({
      ...note.toObject(),
      patient: patientMap.get(note.patientId) ? serializeDoc(patientMap.get(note.patientId)) : null,
    }));

    return successResponse(serializeDoc(enriched), "Nursing notes fetched", 200, {
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
    const session = await requireHospitalPermission(req, "nursing_notes_create");
    const hospitalId = session.payload.hospitalId;
    const body = noteCreateSchema.parse(await req.json());
    await connectDb();

    const patient = await Patient.findOne({ hospitalId, patientId: body.patientId });
    if (!patient) return errorResponse("Patient not found", 404);

    if (body.appointmentId) {
      const appointment = await Appointment.findOne({ hospitalId, appointmentId: body.appointmentId });
      if (!appointment) return errorResponse("Appointment not found", 404);
      if (appointment.patientId !== body.patientId) return errorResponse("Appointment patient does not match", 409);
    }

    const nursingNote = await NursingNote.create({
      hospitalId,
      noteId: await generateNursingNoteId(hospitalId),
      patientId: body.patientId,
      appointmentId: body.appointmentId || "",
      consultationId: "",
      nurseUserId: session.payload.userId,
      noteType: body.noteType ?? "General",
      priority: body.priority ?? "Normal",
      title: body.title ?? "",
      note: body.note,
      patientVisible: body.patientVisible ?? false,
      status: "Active",
    } as Record<string, unknown>);

    return successResponse(serializeDoc(nursingNote), "Nursing note created", 201);
  } catch (error) {
    return handleApiError(error);
  }
}
