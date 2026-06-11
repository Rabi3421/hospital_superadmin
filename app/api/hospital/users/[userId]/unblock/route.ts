import { NextRequest } from "next/server";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import { ensureCanManageHospitalUser } from "@/lib/hospital-users";
import HospitalUser from "@/models/HospitalUser";

type RouteContext = { params: Promise<{ userId: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "hospital_users_block");
    const { userId } = await context.params;
    await connectDb();

    const target = await HospitalUser.findOne({
      _id: userId,
      hospitalId: session.payload.hospitalId,
    });
    if (!target) return errorResponse("Hospital user not found", 404);

    ensureCanManageHospitalUser(session, target, { allowSelf: true });

    target.status = "Active";
    await target.save();
    const safeUser = await HospitalUser.findById(target._id).select("-passwordHash");

    return successResponse(serializeDoc(safeUser), "Hospital user unblocked");
  } catch (error) {
    return handleApiError(error);
  }
}
