import { NextRequest } from "next/server";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { getSuperAdminFromRequest } from "@/lib/superadmin-auth";
import { reconcileSubscriptionBilling } from "@/lib/subscription-billing";
import { ensureAutomaticBillingReminder } from "@/lib/subscription-collections";
import Subscription from "@/models/Subscription";

function hasValidCronSecret(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && req.headers.get("authorization") === `Bearer ${secret}`);
}

async function reconcile(req: NextRequest) {
  try {
    const admin = await getSuperAdminFromRequest(req);
    if (!admin && !hasValidCronSecret(req)) return errorResponse("Unauthorized", 401);

    await connectDb();
    const subscriptions = await Subscription.find({
      status: { $in: ["Active", "Overdue", "Suspended"] },
      nextBillingDate: { $exists: true },
    }).select("hospitalId");

    const results = [];
    for (const subscription of subscriptions) {
      const reconciled = await reconcileSubscriptionBilling(subscription.hospitalId);
      if (reconciled) {
        await ensureAutomaticBillingReminder(subscription.hospitalId);
        results.push({
          hospitalId: reconciled.hospitalId,
          status: reconciled.status,
          nextBillingDate: reconciled.nextBillingDate,
          graceEndsAt: reconciled.graceEndsAt,
        });
      }
    }

    return successResponse(serializeDoc(results), `Reconciled ${results.length} subscriptions`);
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = reconcile;
export const POST = reconcile;
