import { NextRequest } from "next/server";
import { handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import { galleryCreateSchema } from "@/lib/hospital-content";
import HospitalGallery from "@/models/HospitalGallery";

export async function GET(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "website_content_view");
    const status = req.nextUrl.searchParams.get("status");
    const filter: Record<string, unknown> = { hospitalId: session.payload.hospitalId };
    if (status) filter.status = status;
    await connectDb();
    return successResponse(serializeDoc(await HospitalGallery.find(filter).sort({ sortOrder: 1, createdAt: -1 })), "Gallery fetched");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "website_content_create");
    const body = galleryCreateSchema.parse(await req.json());
    await connectDb();
    const item = await HospitalGallery.create({ ...body, hospitalId: session.payload.hospitalId });
    return successResponse(serializeDoc(item), "Gallery item created", 201);
  } catch (error) {
    return handleApiError(error);
  }
}
