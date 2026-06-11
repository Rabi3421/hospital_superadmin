import { NextRequest } from "next/server";
import { handleApiError, successResponse } from "@/lib/api-response";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import { getSetupProgress } from "@/lib/hospital-management";

export async function GET(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "setup_progress_view");
    return successResponse(await getSetupProgress(session.payload.hospitalId), "Setup progress fetched");
  } catch (error) {
    return handleApiError(error);
  }
}
