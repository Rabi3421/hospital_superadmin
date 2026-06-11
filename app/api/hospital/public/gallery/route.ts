import { NextRequest } from "next/server";
import { handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { getPublicWebsiteAccess } from "@/lib/public-website";
import HospitalGallery from "@/models/HospitalGallery";

export async function GET(req: NextRequest) {
  try {
    const { hospital, response } = await getPublicWebsiteAccess(req);
    if (response) return response;

    await connectDb();
    const gallery = await HospitalGallery.find({ hospitalId: hospital.hospitalId, status: "Active" }).sort({
      sortOrder: 1,
      createdAt: -1,
    });
    return successResponse(serializeDoc(gallery));
  } catch (error) {
    return handleApiError(error);
  }
}
