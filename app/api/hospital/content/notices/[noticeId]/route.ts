import { NextRequest } from "next/server";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import { noticeUpdateSchema } from "@/lib/hospital-content";
import HospitalNotice from "@/models/HospitalNotice";

type RouteContext = { params: Promise<{ noticeId: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "website_content_view");
    const { noticeId } = await context.params;
    await connectDb();
    const notice = await HospitalNotice.findOne({ _id: noticeId, hospitalId: session.payload.hospitalId });
    if (!notice) return errorResponse("Notice not found", 404);
    return successResponse(serializeDoc(notice), "Notice fetched");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "website_content_update");
    const { noticeId } = await context.params;
    const body = noticeUpdateSchema.parse(await req.json());
    const update: Record<string, unknown> = { ...body };
    if (body.status === "Published") update.publishedAt = new Date();
    await connectDb();
    const notice = await HospitalNotice.findOneAndUpdate(
      { _id: noticeId, hospitalId: session.payload.hospitalId },
      { $set: update },
      { new: true, runValidators: true },
    );
    if (!notice) return errorResponse("Notice not found", 404);
    return successResponse(serializeDoc(notice), "Notice updated");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "website_content_delete");
    const { noticeId } = await context.params;
    await connectDb();
    const notice = await HospitalNotice.findOneAndDelete({ _id: noticeId, hospitalId: session.payload.hospitalId });
    if (!notice) return errorResponse("Notice not found", 404);
    return successResponse(null, "Notice deleted");
  } catch (error) {
    return handleApiError(error);
  }
}
