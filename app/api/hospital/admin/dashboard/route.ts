import { NextRequest } from "next/server";
import { handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import { getManagementDashboard } from "@/lib/hospital-management";

export async function GET(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "admin_dashboard_view");
    return successResponse(serializeDoc(await getManagementDashboard(session.payload.hospitalId, false)), "Admin dashboard fetched");
  } catch (error) {
    return handleApiError(error);
  }
}
