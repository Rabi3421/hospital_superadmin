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
    const now = new Date();
    const nextBillingDate = new Date(now);
    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

    const hospital = await Hospital.findOneAndUpdate(
      { hospitalId },
      {
        status: "Active",
        websiteStatus: "Live",
        billingStartDate: now,
        nextBillingDate,
      },
      { new: true },
    );

    if (!hospital) {
      return errorResponse("Hospital not found", 404);
    }

    await Subscription.findOneAndUpdate(
      { hospitalId },
      { status: "Active", startDate: now, nextBillingDate },
      { new: true },
    );

    return successResponse(serializeDoc(hospital), "Hospital activated");
  } catch (error) {
    return handleApiError(error);
  }
}
