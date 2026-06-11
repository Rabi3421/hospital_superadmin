import { NextRequest } from "next/server";
import { handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import { noticeCreateSchema } from "@/lib/hospital-content";
import HospitalNotice from "@/models/HospitalNotice";

export async function GET(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "website_content_view");
    const status = req.nextUrl.searchParams.get("status");
    const filter: Record<string, unknown> = { hospitalId: session.payload.hospitalId };
    if (status) filter.status = status;
    await connectDb();
    return successResponse(serializeDoc(await HospitalNotice.find(filter).sort({ createdAt: -1 })), "Notices fetched");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "website_content_create");
    const body = noticeCreateSchema.parse(await req.json());
    await connectDb();
    const notice = await HospitalNotice.create({
      ...body,
      hospitalId: session.payload.hospitalId,
      publishedAt: body.status === "Published" ? new Date() : undefined,
    });
    return successResponse(serializeDoc(notice), "Notice created", 201);
  } catch (error) {
    return handleApiError(error);
  }
}
