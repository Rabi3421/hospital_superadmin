import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { getSuperAdminFromRequest } from "@/lib/superadmin-auth";
import Hospital from "@/models/Hospital";
import ReferralPartner from "@/models/ReferralPartner";

const updateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().max(30).optional(),
  email: z.string().trim().email().or(z.literal("")).optional(),
  organization: z.string().trim().max(120).optional(),
  type: z.enum(["Individual", "Employee", "Agency", "Partner"]).optional(),
  status: z.enum(["Active", "Inactive"]).optional(),
  payoutNote: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(1000).optional(),
});

type RouteContext = { params: Promise<{ referralPartnerId: string }> };

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const admin = await getSuperAdminFromRequest(req);
    if (!admin) return errorResponse("Unauthorized", 401);
    const body = updateSchema.parse(await req.json());
    await connectDb();
    const { referralPartnerId } = await context.params;
    const duplicateConditions: Record<string, string>[] = [];
    if (body.email) duplicateConditions.push({ email: body.email.toLowerCase() });
    if (body.phone) duplicateConditions.push({ phone: body.phone });
    if (duplicateConditions.length) {
      const duplicate = await ReferralPartner.findOne({
        referralPartnerId: { $ne: referralPartnerId },
        $or: duplicateConditions,
      });
      if (duplicate) return errorResponse(`A matching referral profile already exists: ${duplicate.name}`, 409);
    }
    const partner = await ReferralPartner.findOneAndUpdate({ referralPartnerId }, body, { new: true, runValidators: true });
    if (!partner) return errorResponse("Referral partner not found", 404);
    if (body.name) {
      await Hospital.updateMany({ referralPartnerId }, { $set: { referredBy: body.name } });
    }
    return successResponse(serializeDoc(partner), "Referral partner updated");
  } catch (error) {
    return handleApiError(error);
  }
}
