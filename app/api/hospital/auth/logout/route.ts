import { clearHospitalAuthCookie } from "@/lib/hospital-auth";
import { successResponse } from "@/lib/api-response";

export async function POST() {
  const response = successResponse(null, "Hospital user logged out");
  clearHospitalAuthCookie(response);
  return response;
}
