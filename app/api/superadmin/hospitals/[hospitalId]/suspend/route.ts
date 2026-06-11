import { NextRequest } from "next/server";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { getSuperAdminFromRequest } from "@/lib/superadmin-auth";
import Hospital from "@/models/Hospital";
import Subscription from "@/models/Subscription";

type RouteContext = {
  params: Promise<{ hospitalId: string }>;
};

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const admin = await getSuperAdminFromRequest(req);
    if (!admin) {
      return errorResponse("Unauthorized", 401);
    }

    await connectDb();
    const { hospitalId } = await context.params;
    const hospital = await Hospital.findOneAndUpdate(
      { hospitalId },
      { status: "Suspended", websiteStatus: "Maintenance" },
      { new: true },
    );

    if (!hospital) {
      return errorResponse("Hospital not found", 404);
    }

    await Subscription.findOneAndUpdate({ hospitalId }, { status: "Suspended" });
    return successResponse(serializeDoc(hospital), "Hospital suspended");
  } catch (error) {
    return handleApiError(error);
  }
}
