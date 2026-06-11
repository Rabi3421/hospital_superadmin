import { NextRequest } from "next/server";
import { handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { getPublicWebsiteAccess } from "@/lib/public-website";
import HospitalDoctorPublicProfile from "@/models/HospitalDoctorPublicProfile";

export async function GET(req: NextRequest) {
  try {
    const { hospital, response } = await getPublicWebsiteAccess(req);
    if (response) return response;

    await connectDb();
    const doctors = await HospitalDoctorPublicProfile.find({ hospitalId: hospital.hospitalId, status: "Active" }).sort({
      name: 1,
    });
    return successResponse(serializeDoc(doctors));
  } catch (error) {
    return handleApiError(error);
  }
}
