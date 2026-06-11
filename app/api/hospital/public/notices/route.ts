import { NextRequest } from "next/server";
import { handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { getPublicWebsiteAccess } from "@/lib/public-website";
import HospitalNotice from "@/models/HospitalNotice";

export async function GET(req: NextRequest) {
  try {
    const { hospital, response } = await getPublicWebsiteAccess(req);
    if (response) return response;

    await connectDb();
    const notices = await HospitalNotice.find({ hospitalId: hospital.hospitalId, status: "Published" }).sort({
      publishedAt: -1,
      createdAt: -1,
    });
    return successResponse(serializeDoc(notices));
  } catch (error) {
    return handleApiError(error);
  }
}
