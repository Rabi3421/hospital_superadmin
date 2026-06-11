import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { getSuperAdminFromRequest } from "@/lib/superadmin-auth";
import Hospital from "@/models/Hospital";
import HospitalNotice from "@/models/HospitalNotice";

const noticeSchema = z.object({
  hospitalId: z.string().min(1),
  title: z.string().min(2),
  content: z.string().min(3),
  type: z.enum(["General", "Emergency", "Holiday", "Announcement"]).default("General"),
  status: z.enum(["Published", "Draft"]).default("Draft"),
});

export async function GET(req: NextRequest) {
  try {
    const admin = await getSuperAdminFromRequest(req);
    if (!admin) return errorResponse("Unauthorized", 401);

    await connectDb();
    const hospitalId = req.nextUrl.searchParams.get("hospitalId")?.trim();
    const filter = hospitalId ? { hospitalId } : {};
    const notices = await HospitalNotice.find(filter).sort({ createdAt: -1 });
    return successResponse(serializeDoc(notices));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await getSuperAdminFromRequest(req);
    if (!admin) return errorResponse("Unauthorized", 401);

    const body = noticeSchema.parse(await req.json());
    await connectDb();
    const hospital = await Hospital.findOne({ hospitalId: body.hospitalId });
    if (!hospital) return errorResponse("Hospital not found", 404);

    const notice = await HospitalNotice.create({
      ...body,
      publishedAt: body.status === "Published" ? new Date() : undefined,
    });
    return successResponse(serializeDoc(notice), "Notice created", 201);
  } catch (error) {
    return handleApiError(error);
  }
}
