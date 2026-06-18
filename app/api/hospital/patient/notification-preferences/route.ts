import { NextRequest } from "next/server";
import { z } from "zod";
import { handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requirePatientAuth } from "@/lib/hospital-patient";
import NotificationPreference from "@/models/NotificationPreference";

const preferenceUpdateSchema = z.object({
  whatsappOptIn: z.boolean().optional(),
  smsOptIn: z.boolean().optional(),
  appointmentUpdates: z.boolean().optional(),
  labUpdates: z.boolean().optional(),
  billingUpdates: z.boolean().optional(),
  prescriptionUpdates: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await requirePatientAuth(req);
    const hospitalId = session.payload.hospitalId;
    const patientId = session.patient.patientId;
    await connectDb();

    let preference = await NotificationPreference.findOne({ hospitalId, patientId });

    // Create default preferences if not exists
    if (!preference) {
      preference = await NotificationPreference.create({
        hospitalId,
        patientId,
        phone: session.patient.phone ?? "",
        whatsappOptIn: true,
        smsOptIn: true,
        appointmentUpdates: true,
        labUpdates: true,
        billingUpdates: true,
        prescriptionUpdates: true,
        marketingOptIn: false,
      });
    }

    return successResponse(serializeDoc(preference), "Notification preferences fetched");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requirePatientAuth(req);
    const hospitalId = session.payload.hospitalId;
    const patientId = session.patient.patientId;
    const body = preferenceUpdateSchema.parse(await req.json());
    await connectDb();

    const preference = await NotificationPreference.findOneAndUpdate(
      { hospitalId, patientId },
      {
        $set: body,
        $setOnInsert: {
          hospitalId,
          patientId,
          phone: session.patient.phone ?? "",
        },
      },
      { new: true, upsert: true },
    );

    return successResponse(serializeDoc(preference), "Notification preferences updated");
  } catch (error) {
    return handleApiError(error);
  }
}
