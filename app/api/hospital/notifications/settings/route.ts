import { NextRequest } from "next/server";
import { z } from "zod";
import { handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requireHospitalRole } from "@/lib/hospital-auth";
import { getOrCreateNotificationSettings } from "@/lib/notifications/notification-service";
import HospitalNotificationSetting from "@/models/HospitalNotificationSetting";

const settingsUpdateSchema = z.object({
  whatsappEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  defaultChannel: z.enum(["WHATSAPP", "SMS", "BOTH", "NONE"]).optional(),
  provider: z.enum(["MOCK", "MSG91", "TWILIO", "GUPSHUP", "WHATSAPP_CLOUD", "CUSTOM"]).optional(),
  smsProvider: z.enum(["MOCK", "MSG91", "TWILIO", "GUPSHUP", "WHATSAPP_CLOUD", "CUSTOM"]).optional(),
  whatsappProvider: z.enum(["MOCK", "MSG91", "TWILIO", "GUPSHUP", "WHATSAPP_CLOUD", "CUSTOM"]).optional(),
  senderId: z.string().optional(),
  whatsappPhoneNumberId: z.string().optional(),
  appointmentNotificationsEnabled: z.boolean().optional(),
  queueNotificationsEnabled: z.boolean().optional(),
  prescriptionNotificationsEnabled: z.boolean().optional(),
  labNotificationsEnabled: z.boolean().optional(),
  billingNotificationsEnabled: z.boolean().optional(),
  pharmacyNotificationsEnabled: z.boolean().optional(),
  followUpNotificationsEnabled: z.boolean().optional(),
  quietHoursEnabled: z.boolean().optional(),
  quietHoursStart: z.string().optional(),
  quietHoursEnd: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await requireHospitalRole(req, ["HOSPITAL_ADMIN", "MANAGING_DIRECTOR"]);
    const hospitalId = session.payload.hospitalId;
    await connectDb();

    // Ensure settings exist (creates defaults if missing)
    await getOrCreateNotificationSettings(hospitalId);

    // Re-fetch excluding encryptedConfig
    const settings = await HospitalNotificationSetting.findOne({ hospitalId }).select("-encryptedConfig");

    return successResponse(serializeDoc(settings), "Notification settings fetched");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireHospitalRole(req, ["HOSPITAL_ADMIN", "MANAGING_DIRECTOR"]);
    const hospitalId = session.payload.hospitalId;
    const body = settingsUpdateSchema.parse(await req.json());
    await connectDb();

    // Ensure settings exist
    await getOrCreateNotificationSettings(hospitalId);

    const settings = await HospitalNotificationSetting.findOneAndUpdate(
      { hospitalId },
      { $set: { ...body, updatedBy: session.payload.userId } },
      { new: true },
    ).select("-encryptedConfig");

    return successResponse(serializeDoc(settings), "Notification settings updated");
  } catch (error) {
    return handleApiError(error);
  }
}
