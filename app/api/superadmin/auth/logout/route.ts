import { clearSuperAdminCookie } from "@/lib/superadmin-auth";
import { successResponse } from "@/lib/api-response";

export async function POST() {
  const response = successResponse(null, "Logged out");
  clearSuperAdminCookie(response);
  return response;
}
