import { NextRequest } from "next/server";
import { errorResponse, serializeDoc, successResponse } from "@/lib/api-response";
import { getSuperAdminFromRequest } from "@/lib/superadmin-auth";

export async function GET(req: NextRequest) {
  const admin = await getSuperAdminFromRequest(req);
  if (!admin) {
    return errorResponse("Unauthorized", 401);
  }

  return successResponse(serializeDoc(admin), "Authenticated");
}
