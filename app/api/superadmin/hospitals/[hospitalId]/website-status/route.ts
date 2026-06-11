import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { getSuperAdminFromRequest } from "@/lib/superadmin-auth";
import Hospital from "@/models/Hospital";

const websiteStatusSchema = z.object({
  websiteStatus: z.enum(["Live", "Maintenance", "Coming Soon"]),
});

type RouteContext = { params: Promise<{ hospitalId: string }> };

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const admin = await getSuperAdminFromRequest(req);
    if (!admin) return errorResponse("Unauthorized", 401);

    const body = websiteStatusSchema.parse(await req.json());
    await connectDb();
    const { hospitalId } = await context.params;
    const hospital = await Hospital.findOneAndUpdate({ hospitalId }, body, { new: true });
    if (!hospital) return errorResponse("Hospital not found", 404);

    return successResponse(serializeDoc(hospital), "Website status updated");
  } catch (error) {
    return handleApiError(error);
  }
}
