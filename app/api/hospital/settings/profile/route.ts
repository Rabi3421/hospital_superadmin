import { NextRequest } from "next/server";
import { handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import { hospitalProfileUpdateSchema } from "@/lib/hospital-management";
import Hospital from "@/models/Hospital";

const fields = "hospitalId name slug type ownerName ownerPhone ownerEmail address city state pincode logoUrl registrationNumber gstNumber websiteStatus status settings";

export async function GET(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "hospital_profile_view");
    await connectDb();
    const hospital = await Hospital.findOne({ hospitalId: session.payload.hospitalId }).select(fields);
    return successResponse(serializeDoc(hospital), "Hospital profile fetched");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "hospital_profile_update");
    const body = hospitalProfileUpdateSchema.parse(await req.json());
    const update: Record<string, unknown> = { ...body };
    delete update.settings;
    for (const [key, value] of Object.entries(body.settings ?? {})) {
      update[`settings.${key}`] = value;
    }
    await connectDb();
    const hospital = await Hospital.findOneAndUpdate(
      { hospitalId: session.payload.hospitalId },
      { $set: update },
      { new: true, runValidators: true },
    ).select(fields);
    return successResponse(serializeDoc(hospital), "Hospital profile updated");
  } catch (error) {
    return handleApiError(error);
  }
}
