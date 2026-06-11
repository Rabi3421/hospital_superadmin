import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { errorResponse, handleApiError, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import { ensureCanManageHospitalUser, hospitalUserResetPasswordSchema } from "@/lib/hospital-users";
import HospitalUser from "@/models/HospitalUser";

type RouteContext = { params: Promise<{ userId: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "hospital_users_reset_password");
    const { userId } = await context.params;
    const body = hospitalUserResetPasswordSchema.parse(await req.json());
    await connectDb();

    const target = await HospitalUser.findOne({
      _id: userId,
      hospitalId: session.payload.hospitalId,
    });
    if (!target) return errorResponse("Hospital user not found", 404);

    ensureCanManageHospitalUser(session, target, {
      selfMessage: "Forbidden: cannot reset your own password from this admin endpoint",
    });

    target.passwordHash = await bcrypt.hash(body.newPassword, 12);
    await target.save();

    return successResponse({ ok: true }, "Hospital user password reset");
  } catch (error) {
    return handleApiError(error);
  }
}
