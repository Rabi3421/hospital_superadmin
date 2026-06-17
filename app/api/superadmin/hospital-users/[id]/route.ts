import { NextRequest } from "next/server";
import { errorResponse, handleApiError, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { getSuperAdminFromRequest } from "@/lib/superadmin-auth";
import HospitalUser from "@/models/HospitalUser";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const admin = await getSuperAdminFromRequest(req);
    if (!admin) {
      return errorResponse("Unauthorized", 401);
    }

    await connectDb();
    const { id } = await context.params;
    const user = await HospitalUser.findByIdAndDelete(id);
    if (!user) {
      return errorResponse("Hospital user not found", 404);
    }

    return successResponse(null, "Hospital user deleted");
  } catch (error) {
    return handleApiError(error);
  }
}
