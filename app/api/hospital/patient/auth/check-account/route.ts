import { NextRequest } from "next/server";
import { handleApiError, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { getHospitalIdFromRequest } from "@/lib/tenant";
import HospitalUser from "@/models/HospitalUser";

export async function GET(req: NextRequest) {
  try {
    const hospitalId = getHospitalIdFromRequest(req);
    const identifier = (req.nextUrl.searchParams.get("email") ?? req.nextUrl.searchParams.get("phone") ?? "").trim();
    if (!hospitalId || !identifier) {
      return successResponse({ accountExists: false }, "Account check completed");
    }

    await connectDb();
    const account = await HospitalUser.exists({
      hospitalId,
      role: "PATIENT",
      $or: [{ email: identifier.toLowerCase() }, { phone: identifier }],
    });

    return successResponse({ accountExists: Boolean(account) }, "Account check completed");
  } catch (error) {
    return handleApiError(error);
  }
}
