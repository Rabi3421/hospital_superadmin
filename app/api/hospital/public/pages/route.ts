import { NextRequest } from "next/server";
import { handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { getPublicWebsiteAccess } from "@/lib/public-website";
import HospitalWebsitePage from "@/models/HospitalWebsitePage";

export async function GET(req: NextRequest) {
  try {
    const { hospital, response } = await getPublicWebsiteAccess(req);
    if (response) return response;
    await connectDb();
    const pages = await HospitalWebsitePage.find({ hospitalId: hospital.hospitalId, status: "Published" }).select("pageKey label content");
    return successResponse(serializeDoc(pages), "Website pages fetched");
  } catch (error) {
    return handleApiError(error);
  }
}
