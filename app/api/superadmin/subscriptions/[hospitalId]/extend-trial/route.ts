import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { getSuperAdminFromRequest } from "@/lib/superadmin-auth";
import Hospital from "@/models/Hospital";
import Subscription from "@/models/Subscription";

const extendTrialSchema = z.object({
  days: z.coerce.number().int().min(1).max(365),
});

type RouteContext = { params: Promise<{ hospitalId: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const admin = await getSuperAdminFromRequest(req);
    if (!admin) return errorResponse("Unauthorized", 401);

    const { days } = extendTrialSchema.parse(await req.json());
    await connectDb();
    const { hospitalId } = await context.params;
    const hospital = await Hospital.findOne({ hospitalId });
    if (!hospital) return errorResponse("Hospital not found", 404);

    const baseDate = hospital.trialEndDate && hospital.trialEndDate > new Date() ? hospital.trialEndDate : new Date();
    const trialEndDate = new Date(baseDate);
    trialEndDate.setDate(trialEndDate.getDate() + days);

    hospital.trialEndDate = trialEndDate;
    if (hospital.status !== "Active") hospital.status = "Trial";
    await hospital.save();

    const subscription = await Subscription.findOneAndUpdate(
      { hospitalId },
      {
        endDate: trialEndDate,
        nextBillingDate: trialEndDate,
        ...(hospital.status !== "Active" ? { status: "Trial" } : {}),
      },
      { new: true },
    );

    return successResponse(serializeDoc({ hospital, subscription }), "Trial extended");
  } catch (error) {
    return handleApiError(error);
  }
}
