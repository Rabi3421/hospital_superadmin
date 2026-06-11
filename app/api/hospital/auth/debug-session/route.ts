import { NextRequest } from "next/server";
import { errorResponse, successResponse } from "@/lib/api-response";
import { decodeHospitalToken, hospitalUserCookieName } from "@/lib/hospital-auth";

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return errorResponse("Not found", 404);
  }

  const token = req.cookies.get(hospitalUserCookieName)?.value;
  if (!token) {
    return successResponse({ tokenPresent: false, decoded: null });
  }

  try {
    const payload = decodeHospitalToken(token);
    return successResponse({
      tokenPresent: true,
      decoded: {
        userId: payload.userId,
        hospitalId: payload.hospitalId,
        role: payload.role,
        permissions: payload.permissions,
        issuedAt: payload.iat,
        expiresAt: payload.exp,
      },
    });
  } catch {
    return successResponse({ tokenPresent: true, decoded: null, valid: false });
  }
}
