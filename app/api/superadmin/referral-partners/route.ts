import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { getSuperAdminFromRequest } from "@/lib/superadmin-auth";
import Hospital from "@/models/Hospital";
import ReferralPartner from "@/models/ReferralPartner";

const referralPartnerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(30).optional(),
  email: z.string().trim().email().or(z.literal("")).optional(),
  organization: z.string().trim().max(120).optional(),
  type: z.enum(["Individual", "Employee", "Agency", "Partner"]).default("Individual"),
  payoutNote: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(1000).optional(),
});

async function createReferralPartnerId() {
  const year = new Date().getFullYear();
  const prefix = `REF-${year}-`;
  let sequence = await ReferralPartner.countDocuments({ referralPartnerId: new RegExp(`^${prefix}`) }) + 1;
  while (await ReferralPartner.exists({ referralPartnerId: `${prefix}${String(sequence).padStart(4, "0")}` })) sequence += 1;
  return `${prefix}${String(sequence).padStart(4, "0")}`;
}

export async function GET(req: NextRequest) {
  try {
    const admin = await getSuperAdminFromRequest(req);
    if (!admin) return errorResponse("Unauthorized", 401);
    await connectDb();
    const requestedStatus = req.nextUrl.searchParams.get("status");
    const status = requestedStatus === "Active" || requestedStatus === "Inactive" ? requestedStatus : undefined;
    const filter: { status?: "Active" | "Inactive" } = status ? { status } : {};
    const partners = await ReferralPartner.find(filter).sort({ status: 1, name: 1 });
    const hospitalCounts = await Hospital.aggregate([
      { $match: { referralPartnerId: { $nin: [null, ""] } } },
      { $group: { _id: "$referralPartnerId", count: { $sum: 1 } } },
    ]);
    const countMap = new Map(hospitalCounts.map((item) => [item._id, item.count]));
    return successResponse(serializeDoc(partners.map((partner) => ({
      ...partner.toObject(),
      hospitalCount: countMap.get(partner.referralPartnerId) ?? 0,
    }))));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await getSuperAdminFromRequest(req);
    if (!admin) return errorResponse("Unauthorized", 401);
    const body = referralPartnerSchema.parse(await req.json());
    await connectDb();
    const duplicateConditions: Record<string, string>[] = [];
    if (body.email) duplicateConditions.push({ email: body.email.toLowerCase() });
    if (body.phone) duplicateConditions.push({ phone: body.phone });
    if (!duplicateConditions.length) {
      duplicateConditions.push({ name: body.name, organization: body.organization ?? "" });
    }
    const duplicate = await ReferralPartner.findOne({ $or: duplicateConditions });
    if (duplicate) return errorResponse(`A matching referral profile already exists: ${duplicate.name}`, 409);

    const partner = await ReferralPartner.create({
      ...body,
      referralPartnerId: await createReferralPartnerId(),
      status: "Active",
    });
    return successResponse(serializeDoc(partner), "Referral partner created", 201);
  } catch (error) {
    return handleApiError(error);
  }
}
