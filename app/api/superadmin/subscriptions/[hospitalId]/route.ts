import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { getSuperAdminFromRequest } from "@/lib/superadmin-auth";
import Hospital from "@/models/Hospital";
import Subscription from "@/models/Subscription";

const subscriptionUpdateSchema = z.object({
  planName: z.string().min(1).optional(),
  monthlyPrice: z.coerce.number().min(0).optional(),
  billingCycle: z.enum(["Monthly", "Quarterly", "Yearly"]).optional(),
  status: z.enum(["Trial", "Active", "Overdue", "Suspended", "Cancelled"]).optional(),
  nextBillingDate: z.coerce.date().optional(),
  features: z.array(z.string()).optional(),
});

type RouteContext = { params: Promise<{ hospitalId: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const admin = await getSuperAdminFromRequest(req);
    if (!admin) return errorResponse("Unauthorized", 401);

    await connectDb();
    const { hospitalId } = await context.params;
    const subscription = await Subscription.findOne({ hospitalId });
    if (!subscription) return errorResponse("Subscription not found", 404);
    return successResponse(serializeDoc(subscription));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const admin = await getSuperAdminFromRequest(req);
    if (!admin) return errorResponse("Unauthorized", 401);

    const body = subscriptionUpdateSchema.parse(await req.json());
    await connectDb();
    const { hospitalId } = await context.params;
    const hospital = await Hospital.findOne({ hospitalId });
    if (!hospital) return errorResponse("Hospital not found", 404);

    const subscription = await Subscription.findOneAndUpdate({ hospitalId }, body, {
      new: true,
      runValidators: true,
      upsert: true,
      setDefaultsOnInsert: true,
    });

    if (body.planName || body.monthlyPrice !== undefined || body.nextBillingDate) {
      await Hospital.findOneAndUpdate(
        { hospitalId },
        {
          ...(body.planName ? { subscriptionPlan: body.planName } : {}),
          ...(body.monthlyPrice !== undefined ? { monthlyPrice: body.monthlyPrice } : {}),
          ...(body.nextBillingDate ? { nextBillingDate: body.nextBillingDate } : {}),
        },
      );
    }

    return successResponse(serializeDoc(subscription), "Subscription updated");
  } catch (error) {
    return handleApiError(error);
  }
}
