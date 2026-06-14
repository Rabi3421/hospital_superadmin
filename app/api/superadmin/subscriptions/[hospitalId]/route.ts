import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { getSuperAdminFromRequest } from "@/lib/superadmin-auth";
import { getPlanPrice, getSubscriptionPlan, subscriptionPlanNames } from "@/lib/subscription-plans";
import { graceEndsFor, nextMonthlyDueDate } from "@/lib/subscription-billing";
import Hospital from "@/models/Hospital";
import Subscription from "@/models/Subscription";

const subscriptionUpdateSchema = z.object({
  planName: z.enum(subscriptionPlanNames).optional(),
  monthlyPrice: z.coerce.number().min(0).optional(),
  pricingNote: z.string().max(500).optional(),
  billingCycle: z.enum(["Monthly", "Quarterly", "Yearly"]).optional(),
  status: z.enum(["Trial", "Active", "Overdue", "Suspended", "Cancelled"]).optional(),
  nextBillingDate: z.coerce.date().optional(),
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
    const existingSubscription = await Subscription.findOne({ hospitalId });
    const selectedPlan = getSubscriptionPlan(body.planName ?? existingSubscription?.planName ?? hospital.subscriptionPlan);
    if (!selectedPlan) return errorResponse("Invalid subscription plan", 422);
    const selectedPrice = body.monthlyPrice ?? (
      body.planName ? selectedPlan.priceOptions[0] : existingSubscription?.monthlyPrice ?? selectedPlan.priceOptions[0]
    );
    if (getPlanPrice(selectedPlan.name, selectedPrice) === undefined) {
      return errorResponse("Invalid price for the selected subscription plan", 422);
    }
    const priceType = selectedPrice === 0 ? "Free" : selectedPrice === selectedPlan.priceOptions[0] ? "Standard" : "Negotiated";
    const pricingNote = body.pricingNote?.trim() ?? existingSubscription?.pricingNote ?? "";
    if (priceType === "Negotiated" && !pricingNote) {
      return errorResponse("A negotiation note is required for the approved discounted price", 422);
    }
    if (body.status === "Active" && selectedPlan.name === "Free Starter") {
      return errorResponse("Free Starter is a trial-only plan. Select a paid plan before activation.", 422);
    }
    const subscriptionUpdate: Record<string, unknown> = {
      ...body,
      planName: selectedPlan.name,
      monthlyPrice: selectedPrice,
      priceType,
      pricingNote: priceType === "Negotiated" ? pricingNote : "",
      features: [...selectedPlan.features],
    };
    if (body.status === "Active" && !body.nextBillingDate) {
      const nextBillingDate = nextMonthlyDueDate();
      subscriptionUpdate.nextBillingDate = nextBillingDate;
    }
    const effectiveNextBillingDate = body.nextBillingDate ?? subscriptionUpdate.nextBillingDate ?? existingSubscription?.nextBillingDate;
    if (effectiveNextBillingDate) {
      subscriptionUpdate.graceEndsAt = graceEndsFor(new Date(effectiveNextBillingDate as Date));
    }
    const subscription = await Subscription.findOneAndUpdate({ hospitalId }, subscriptionUpdate, {
      new: true,
      runValidators: true,
      upsert: true,
      setDefaultsOnInsert: true,
    });
    if (body.status === "Active" || body.status === "Suspended") {
      await Subscription.updateOne({ hospitalId }, { $unset: { suspendedForNonPaymentAt: 1 } });
    }

    if (body.planName || body.monthlyPrice !== undefined || body.nextBillingDate || body.status) {
      const hospitalStatus = body.status === "Suspended"
        ? "Suspended"
        : body.status === "Overdue" ? undefined : body.status;
      const hospitalSet = {
        subscriptionPlan: selectedPlan.name,
        monthlyPrice: selectedPrice,
        maxDoctors: selectedPlan.maxDoctors,
        maxStaff: selectedPlan.maxStaff,
        maxPatients: selectedPlan.maxPatients,
        ...(body.nextBillingDate ? { nextBillingDate: body.nextBillingDate } : {}),
        ...(hospitalStatus ? { status: hospitalStatus } : {}),
        ...(body.status === "Active" ? {
          billingStartDate: new Date(),
          nextBillingDate: subscriptionUpdate.nextBillingDate,
        } : {}),
      };
      await Hospital.findOneAndUpdate(
        { hospitalId },
        {
          $set: hospitalSet,
          ...(["Active", "Suspended"].includes(body.status ?? "") ? { $unset: { suspendedForNonPaymentAt: 1 } } : {}),
        },
      );
    }

    return successResponse(serializeDoc(subscription), "Subscription updated");
  } catch (error) {
    return handleApiError(error);
  }
}
