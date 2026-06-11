import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { getSuperAdminFromRequest } from "@/lib/superadmin-auth";
import HospitalNotice from "@/models/HospitalNotice";

const noticeUpdateSchema = z.object({
  title: z.string().min(2).optional(),
  content: z.string().min(3).optional(),
  type: z.enum(["General", "Emergency", "Holiday", "Announcement"]).optional(),
  status: z.enum(["Published", "Draft"]).optional(),
});

type RouteContext = { params: Promise<{ noticeId: string }> };

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const admin = await getSuperAdminFromRequest(req);
    if (!admin) return errorResponse("Unauthorized", 401);

    const body = noticeUpdateSchema.parse(await req.json());
    await connectDb();
    const { noticeId } = await context.params;
    const notice = await HospitalNotice.findByIdAndUpdate(
      noticeId,
      {
        ...body,
        ...(body.status === "Published" ? { publishedAt: new Date() } : {}),
      },
      { new: true, runValidators: true },
    );
    if (!notice) return errorResponse("Notice not found", 404);
    return successResponse(serializeDoc(notice), "Notice updated");
  } catch (error) {
    return handleApiError(error);
  }
}
