import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import Patient from "@/models/Patient";
import PaymentReminder from "@/models/PaymentReminder";

const reminderUpdateSchema = z.object({
  status: z.enum(["Sent", "Acknowledged", "Failed"]).optional(),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ reminderId: string }> }) {
  try {
    const session = await requireHospitalPermission(req, "billing_reminders_view");
    const hospitalId = session.payload.hospitalId;
    const { reminderId } = await params;
    await connectDb();

    const reminder = await PaymentReminder.findOne({ hospitalId, reminderId });
    if (!reminder) return errorResponse("Reminder not found", 404);

    const patient = await Patient.findOne({ hospitalId, patientId: reminder.patientId })
      .select("patientId name phone email");

    return successResponse(serializeDoc({ ...reminder.toObject(), patient }), "Reminder details");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ reminderId: string }> }) {
  try {
    const session = await requireHospitalPermission(req, "billing_reminders_create");
    const hospitalId = session.payload.hospitalId;
    const { reminderId } = await params;
    const body = reminderUpdateSchema.parse(await req.json());
    await connectDb();

    const reminder = await PaymentReminder.findOne({ hospitalId, reminderId });
    if (!reminder) return errorResponse("Reminder not found", 404);

    if (body.status) {
      reminder.status = body.status;
      if (body.status === "Acknowledged") reminder.acknowledgedAt = new Date();
    }
    if (body.notes !== undefined) reminder.notes = body.notes;
    await reminder.save();

    return successResponse(serializeDoc(reminder), "Reminder updated");
  } catch (error) {
    return handleApiError(error);
  }
}
