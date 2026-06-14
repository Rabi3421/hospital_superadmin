import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import HospitalWebsitePage from "@/models/HospitalWebsitePage";

const updateSchema = z.object({
  status: z.enum(["Published", "Draft"]).optional(),
  content: z.record(z.string(), z.string().max(5000)).optional(),
});

type RouteContext = { params: Promise<{ pageKey: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "website_content_view");
    const { pageKey } = await context.params;
    await connectDb();
    const page = await HospitalWebsitePage.findOne({ hospitalId: session.payload.hospitalId, pageKey });
    if (!page) return errorResponse("Website page not found", 404);
    return successResponse(serializeDoc(page), "Website page fetched");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "website_content_update");
    const { pageKey } = await context.params;
    const body = updateSchema.parse(await req.json());
    await connectDb();
    const page = await HospitalWebsitePage.findOneAndUpdate(
      { hospitalId: session.payload.hospitalId, pageKey },
      { $set: body },
      { new: true, runValidators: true },
    );
    if (!page) return errorResponse("Website page not found", 404);
    return successResponse(serializeDoc(page), "Website page updated");
  } catch (error) {
    return handleApiError(error);
  }
}
