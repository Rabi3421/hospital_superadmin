import { NextRequest } from "next/server";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { getSuperAdminFromRequest } from "@/lib/superadmin-auth";
import Hospital from "@/models/Hospital";
import Subscription from "@/models/Subscription";

export async function GET(req: NextRequest) {
  try {
    const admin = await getSuperAdminFromRequest(req);
    if (!admin) return errorResponse("Unauthorized", 401);

    await connectDb();
    const search = req.nextUrl.searchParams.get("q")?.trim();
    const status = req.nextUrl.searchParams.get("status")?.trim();

    const hospitalFilter: Record<string, unknown> = {};
    if (search) {
      hospitalFilter.$or = [
        { name: new RegExp(search, "i") },
        { hospitalId: new RegExp(search, "i") },
      ];
    }

    const hospitals = await Hospital.find(hospitalFilter).select("hospitalId name status websiteStatus");
    const hospitalMap = new Map(hospitals.map((hospital) => [hospital.hospitalId, hospital]));
    const filter: Record<string, unknown> = { hospitalId: { $in: [...hospitalMap.keys()] } };
    if (status) filter.status = status;

    const subscriptions = await Subscription.find(filter).sort({ updatedAt: -1 });
    const data = subscriptions.map((subscription) => ({
      ...subscription.toObject(),
      hospital: hospitalMap.get(subscription.hospitalId) ?? null,
    }));

    return successResponse(serializeDoc(data));
  } catch (error) {
    return handleApiError(error);
  }
}
