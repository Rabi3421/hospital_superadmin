import { NextRequest } from "next/server";
import { handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import { hospitalSettingsSchema } from "@/lib/hospital-management";
import Hospital from "@/models/Hospital";

export async function GET(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "hospital_settings_view");
    return successResponse(serializeDoc(session.hospital.settings), "Hospital settings fetched");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "hospital_settings_update");
    const body = hospitalSettingsSchema.parse(await req.json());
    const update = Object.fromEntries(Object.entries(body).map(([key, value]) => [`settings.${key}`, value]));
    await connectDb();
    const hospital = await Hospital.findOneAndUpdate(
      { hospitalId: session.payload.hospitalId },
      { $set: update },
      { new: true, runValidators: true },
    ).select("settings");
    return successResponse(serializeDoc(hospital?.settings), "Hospital settings updated");
  } catch (error) {
    return handleApiError(error);
  }
}
