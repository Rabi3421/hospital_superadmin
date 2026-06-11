import { NextRequest } from "next/server";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { getSuperAdminFromRequest } from "@/lib/superadmin-auth";
import Subscription from "@/models/Subscription";

type RouteContext = { params: Promise<{ hospitalId: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const admin = await getSuperAdminFromRequest(req);
    if (!admin) return errorResponse("Unauthorized", 401);

    await connectDb();
    const { hospitalId } = await context.params;
    const subscription = await Subscription.findOneAndUpdate({ hospitalId }, { status: "Overdue" }, { new: true });
    if (!subscription) return errorResponse("Subscription not found", 404);

    return successResponse(serializeDoc(subscription), "Subscription marked overdue");
  } catch (error) {
    return handleApiError(error);
  }
}
