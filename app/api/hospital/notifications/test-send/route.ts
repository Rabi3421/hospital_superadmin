import { NextRequest } from "next/server";
import { z } from "zod";
import { handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requireHospitalRole } from "@/lib/hospital-auth";
import { testSendNotification } from "@/lib/notifications/notification-service";

const testSendSchema = z.object({
  channel: z.enum(["WHATSAPP", "SMS"]),
  phone: z.string().min(1),
  message: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireHospitalRole(req, ["HOSPITAL_ADMIN", "MANAGING_DIRECTOR"]);
    const hospitalId = session.payload.hospitalId;
    const body = testSendSchema.parse(await req.json());
    await connectDb();

    const result = await testSendNotification(
      hospitalId,
      body.channel,
      body.phone,
      body.message,
    );

    return successResponse(serializeDoc(result), "Test notification sent");
  } catch (error) {
    return handleApiError(error);
  }
}
