import { NextRequest } from "next/server";
import { handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import HospitalContactEnquiry from "@/models/HospitalContactEnquiry";

export async function GET(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "contact_enquiries_view");
    const status = req.nextUrl.searchParams.get("status");
    const filter: Record<string, unknown> = { hospitalId: session.payload.hospitalId };
    if (status) filter.status = status;
    await connectDb();
    return successResponse(serializeDoc(await HospitalContactEnquiry.find(filter).sort({ createdAt: -1 })), "Contact enquiries fetched");
  } catch (error) {
    return handleApiError(error);
  }
}
