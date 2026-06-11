import { NextRequest } from "next/server";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import { galleryUpdateSchema } from "@/lib/hospital-content";
import HospitalGallery from "@/models/HospitalGallery";

type RouteContext = { params: Promise<{ galleryId: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "website_content_view");
    const { galleryId } = await context.params;
    await connectDb();
    const item = await HospitalGallery.findOne({ _id: galleryId, hospitalId: session.payload.hospitalId });
    if (!item) return errorResponse("Gallery item not found", 404);
    return successResponse(serializeDoc(item), "Gallery item fetched");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "website_content_update");
    const { galleryId } = await context.params;
    const body = galleryUpdateSchema.parse(await req.json());
    await connectDb();
    const item = await HospitalGallery.findOneAndUpdate(
      { _id: galleryId, hospitalId: session.payload.hospitalId },
      { $set: body },
      { new: true, runValidators: true },
    );
    if (!item) return errorResponse("Gallery item not found", 404);
    return successResponse(serializeDoc(item), "Gallery item updated");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "website_content_delete");
    const { galleryId } = await context.params;
    await connectDb();
    const item = await HospitalGallery.findOneAndUpdate(
      { _id: galleryId, hospitalId: session.payload.hospitalId },
      { $set: { status: "Inactive" } },
      { new: true },
    );
    if (!item) return errorResponse("Gallery item not found", 404);
    return successResponse(serializeDoc(item), "Gallery item deactivated");
  } catch (error) {
    return handleApiError(error);
  }
}
