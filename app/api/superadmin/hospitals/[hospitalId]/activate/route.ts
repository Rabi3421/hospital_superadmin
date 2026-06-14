import { NextRequest } from "next/server";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { getSuperAdminFromRequest } from "@/lib/superadmin-auth";
import { graceEndsFor, nextMonthlyDueDate } from "@/lib/subscription-billing";
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
    const nextBillingDate = nextMonthlyDueDate(now);
    const existingHospital = await Hospital.findOne({ hospitalId });
    if (!existingHospital) {
      return errorResponse("Hospital not found", 404);
    }
    if (existingHospital.subscriptionPlan === "Free Starter") {
      return errorResponse("Select Core Care or Complete Care before activating this hospital", 422);
    }

    const hospital = await Hospital.findOneAndUpdate(
      { hospitalId },
      {
        $set: {
          status: "Active",
          websiteStatus: "Live",
          billingStartDate: now,
          nextBillingDate,
        },
        $unset: { suspendedForNonPaymentAt: 1 },
      },
      { new: true },
    );

    await Subscription.findOneAndUpdate(
      { hospitalId },
      {
        $set: {
          status: "Active",
          startDate: now,
          nextBillingDate,
          graceEndsAt: graceEndsFor(nextBillingDate),
        },
        $unset: { suspendedForNonPaymentAt: 1 },
      },
      { new: true },
    );

    return successResponse(serializeDoc(hospital), "Hospital activated");
  } catch (error) {
    return handleApiError(error);
  }
}
