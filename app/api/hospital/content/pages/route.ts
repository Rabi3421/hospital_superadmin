import { NextRequest } from "next/server";
import { handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import HospitalWebsitePage from "@/models/HospitalWebsitePage";
import { seedHospitalWebsiteStarter } from "@/lib/hospital-website-starter";

export async function GET(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "website_content_view");
    await connectDb();
    const pages = await HospitalWebsitePage.find({ hospitalId: session.payload.hospitalId }).sort({ label: 1 });
    return successResponse(serializeDoc(pages), "Website pages fetched");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "website_content_create");
    await connectDb();
    await seedHospitalWebsiteStarter(session.hospital);
    const pages = await HospitalWebsitePage.find({ hospitalId: session.payload.hospitalId }).sort({ label: 1 });
    return successResponse(serializeDoc(pages), "Missing starter website content created");
  } catch (error) {
    return handleApiError(error);
  }
}
