import { NextRequest } from "next/server";
import { handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { buildPatientDashboard, requirePatientAuth } from "@/lib/hospital-patient";

export async function GET(req: NextRequest) {
  try {
    const session = await requirePatientAuth(req);
    await connectDb();
    return successResponse(serializeDoc(await buildPatientDashboard(session)), "Patient dashboard fetched");
  } catch (error) {
    return handleApiError(error);
  }
}
