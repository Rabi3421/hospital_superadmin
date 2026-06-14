import { NextRequest } from "next/server";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { reconcileSubscriptionBilling } from "@/lib/subscription-billing";
import { getHospitalIdFromRequest } from "@/lib/tenant";
import Hospital from "@/models/Hospital";

export async function GET(req: NextRequest) {
  try {
    const hospitalId = getHospitalIdFromRequest(req);
    if (!hospitalId) {
      return errorResponse("Hospital ID is required", 400);
    }

    await connectDb();
    await reconcileSubscriptionBilling(hospitalId);
    const hospital = await Hospital.findOne({ hospitalId }).select(
      "hospitalId name slug logoUrl type status websiteStatus",
    );
    if (!hospital) {
      return errorResponse("Hospital not found", 404);
    }
    if (["Suspended", "Cancelled"].includes(hospital.status)) {
      return errorResponse(`Hospital is ${hospital.status.toLowerCase()}`, 403, {
        status: hospital.status,
        websiteStatus: hospital.websiteStatus,
      });
    }
    if (hospital.websiteStatus === "Maintenance") {
      return errorResponse("Hospital website is currently under maintenance", 503, {
        status: hospital.status,
        websiteStatus: hospital.websiteStatus,
      });
    }

    return successResponse(serializeDoc(hospital));
  } catch (error) {
    return handleApiError(error);
  }
}
